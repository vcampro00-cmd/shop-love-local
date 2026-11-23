import { afterEach, expect, it, vi } from "vitest";
import { sendCashConfirmation } from "@/lib/whatsapp.server";

const { insert } = vi.hoisted(() => ({ insert: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert,
      select: () => {
        const query = { eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
        return query;
      },
    }),
  },
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("sends each saved cash instalment date and amount inside the approved template variable", async () => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only");
  vi.stubEnv("WHATSAPP_API_KEY", "test-only");
  const requests: { template: { name: string; components: { parameters: { text: string }[] }[] } }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ messages: [{ id: "test-message" }] }), { status: 200 });
  }));

  const result = await sendCashConfirmation("33612345678", "Test", 300, 100, [
    { amount: 80, dueDate: "2026-11-30" },
    { amount: 120, dueDate: "2026-12-09" },
  ]);

  expect(result.sent).toBe(true);
  const request = requests[0];
  expect(request?.template.name).toBe("vcampro_confirmation_especes");
  const parameters = request?.template.components[0]?.parameters;
  expect(parameters).toHaveLength(4);
  expect(parameters?.[3]?.text).toContain("80,00 € — 30/11/2026");
  expect(parameters?.[3]?.text).toContain("120,00 € — 09/12/2026");
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ wa_message_id: "test-message", status: "accepted" }));
});