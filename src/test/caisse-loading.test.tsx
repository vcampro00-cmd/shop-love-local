import { Component, useCallback, type ReactNode } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { CashBook } from "@/lib/cash";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: (...args: unknown[]) => unknown) => useCallback(fn, [fn]),
}));
vi.mock("@/lib/content", () => ({ useText: () => (key: string) => key }));
vi.mock("@/lib/orders.functions", () => ({
  cancelSecondPayment: vi.fn(), chargeSecondPaymentNow: vi.fn(), setSecondChargeDate: vi.fn(),
}));
vi.mock("@/lib/cash.functions", () => Object.fromEntries([
  "addEmployee", "addExpense", "addReminder", "addWarranty", "deleteEmployee",
  "deleteExpense", "deleteReminder", "cancelReminder", "chargeReminderNow",
  "listCancelledReminders", "getCashBook", "listReminders", "listWarranties",
  "markReminderPaid", "cashReminderToCard", "setWarrantyImei", "setCashDrawer", "payDebt",
  "correctCashDrawer", "sendCashConfirmationFn",
].map((name) => [name, vi.fn().mockResolvedValue([])])));

import { getCashBook } from "@/lib/cash.functions";
import { Route } from "@/routes/_authenticated/caisse";

describe("Caisse loading", () => {
  it("does not crash when the owner's cash book finishes loading", async () => {
    const errors: Error[] = [];
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false };
      static getDerivedStateFromError() { return { failed: true }; }
      override componentDidCatch(error: Error) { errors.push(error); }
      override render() { return this.state.failed ? null : this.props.children; }
    }
    let resolveBook: ((book: CashBook) => void) | undefined;
    vi.mocked(getCashBook).mockReturnValueOnce(new Promise((resolve) => { resolveBook = resolve; }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Caisse = Route.options.component;
    if (!Caisse) throw new Error("Caisse component is missing");
    const view = render(<QueryClientProvider client={queryClient}><Boundary><Caisse /></Boundary></QueryClientProvider>);
    await waitFor(() => expect(getCashBook).toHaveBeenCalled());
    expect(queryClient.getQueryState(["cash-book"])?.status).toBe("pending");
    await act(async () => {
      resolveBook?.({ entries: [], expenses: [], purchases: [], employees: [] });
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await waitFor(() => expect(queryClient.getQueryState(["cash-book"])?.status).toBe("success"));
    expect(errors).toEqual([]);
    view.unmount();
    queryClient.clear();
  });
});