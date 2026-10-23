import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";
import { processPendingEvents, processWebhookEvent } from "@/lib/whatsapp.server";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("Not configured", { status: 500 });
        let payload: unknown;
        try {
          const verified = await verifyWebhookRequest({ request, secret, maxBodyBytes: 4 * 1024 * 1024 } as any);
          payload = (verified as any)?.payload ?? (verified as any)?.body ?? verified;
          if (typeof payload === "string") payload = JSON.parse(payload);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const deliveryId = request.headers.get("x-lovable-delivery");
        const event = request.headers.get("x-lovable-event");
        if (!deliveryId || !event) return new Response("Missing headers", { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await db
          .from("whatsapp_webhook_events")
          .upsert({ delivery_id: deliveryId, event, payload: payload as any }, { onConflict: "delivery_id", ignoreDuplicates: false })
          .select("id, processed_at")
          .single();
        if (error || !row) return new Response("Store failed", { status: 500 });
        try {
          if (!row.processed_at) await processWebhookEvent(row.id);
        } catch {
          return new Response("Processing failed", { status: 500 });
        }
        await processPendingEvents(5);
        return Response.json({ ok: true });
      },
    },
  },
});
