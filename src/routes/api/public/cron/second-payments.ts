import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { chargeDueInstallments } from "@/lib/payments.server";

export const Route = createFileRoute("/api/public/cron/second-payments")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const result = await chargeDueInstallments();
        return Response.json(result);
      },
    },
  },
});
