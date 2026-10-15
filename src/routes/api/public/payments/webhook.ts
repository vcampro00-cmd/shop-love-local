import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { applyPaidSession, applyPaidReminder } from "@/lib/payments.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
            // Paiement d'un rappel (lien /pagar) → caisse ; sinon commande classique.
            if (event.data.object?.metadata?.reminderId) {
              await applyPaidReminder(event.data.object.id, env);
            } else {
              await applyPaidSession(event.data.object.id, env);
            }
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
