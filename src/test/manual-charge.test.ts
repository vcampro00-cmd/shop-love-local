import { beforeEach, describe, expect, it, vi } from "vitest";
import { canChargeReminder } from "@/lib/cash";

const mocks = vi.hoisted(() => ({ create: vi.fn(), row: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[] }));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({ paymentIntents: { create: mocks.create } }),
  getStripeErrorMessage: () => "Carte refusée",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, is: () => query,
      maybeSingle: async () => ({ data: mocks.row }),
      update: (value: Record<string, unknown>) => { mocks.updates.push(value); return query; },
      insert: async (value: Record<string, unknown>) => { mocks.inserts.push(value); return {}; },
      then: (resolve: (value: unknown) => void) => resolve({ data: table === "payment_reminders" ? [{ id: "reminder" }] : [] }),
    };
    return query;
  } },
}));
import { chargeReminderInstallmentNow } from "@/lib/payments.server";

beforeEach(() => {
  mocks.row = { id: "reminder", amount: 250, installment: 2, installments: 2, stripe_customer_id: "customer", stripe_payment_method_id: "card", payment_env: "live", name: "Client", charge_error: "failed", paid_session_id: null, cancelled_at: null };
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.create.mockReset().mockResolvedValue({ id: "pi_paid", status: "succeeded" });
});
describe("manual instalment collection", () => {
  it("allows a failed manual reminder with a saved card regardless of its date", () => {
    expect(canChargeReminder({ paid: false, fromOrder: false, canCharge: true })).toBe(true);
    expect(canChargeReminder({ paid: false, fromOrder: false, canCharge: false })).toBe(false);
    expect(canChargeReminder({ paid: true, fromOrder: false, canCharge: true })).toBe(false);
    expect(canChargeReminder({ paid: false, fromOrder: true })).toBe(true);
  });
  it("retries the stored 250 euro balance, clears failure and credits only 250 euros", async () => {
    expect(await chargeReminderInstallmentNow("reminder")).toEqual({ ok: true });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 25000, customer: "customer", payment_method: "card" }), { idempotencyKey: expect.stringMatching(/^reminder-reminder-charge-retry-/) });
    expect(mocks.updates[0]).toMatchObject({ paid_session_id: "pi_paid", charge_error: null });
    expect(mocks.inserts[0]).toMatchObject({ amount: 250, kind: "auto" });
  });
  it.each(["paid_session_id", "cancelled_at"])("never charges a reminder with %s already set", async (field) => {
    mocks.row[field] = "already-set";
    expect((await chargeReminderInstallmentNow("reminder")).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("manual and automatic first attempts use the existing shared key", async () => {
    mocks.row['charge_error'] = null;
    await chargeReminderInstallmentNow("reminder");
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: "reminder-reminder-charge" });
  });
});