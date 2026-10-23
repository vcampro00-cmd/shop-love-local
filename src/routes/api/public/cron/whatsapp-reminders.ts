import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { processPendingEvents, sendDueReminders } from "@/lib/whatsapp.server";

export const Route = createFileRoute("/api/public/cron/whatsapp-reminders")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const result = await sendDueReminders();
        await processPendingEvents(20);
        return Response.json(result);
      },
    },
  },
});
