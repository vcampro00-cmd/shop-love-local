import { createFileRoute } from "@tanstack/react-router";

// Lien court envoyé sur WhatsApp : vcampro.shop/pagar/<id du rappel>.
// Le montant vient toujours du rappel enregistré, jamais de l'URL.
export const Route = createFileRoute("/pagar/$id")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const origin = new URL(request.url).origin;
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return Response.redirect(`${origin}/`, 302);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { createStripeClient } = await import("@/lib/stripe.server");
        const { data: row } = await supabaseAdmin
          .from("payment_reminders").select("id, name, amount").eq("id", params.id).maybeSingle();
        if (!row) return new Response("Lien de paiement introuvable.", { status: 404 });
        try {
          const stripe = createStripeClient("sandbox");
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(Number(row.amount) * 100), product_data: { name: `Paiement convenu — ${row.name}` } } }],
            payment_method_types: ["card"],
            payment_intent_data: { description: `Paiement convenu — ${row.name}` },
            // Relie la session au rappel : le webhook crédite la caisse au paiement.
            metadata: { reminderId: row.id },
            success_url: `${origin}/?paiement=ok`,
            cancel_url: `${origin}/?paiement=annule`,
          });
          if (!session.url) return new Response("Paiement indisponible.", { status: 503 });
          return Response.redirect(session.url, 303);
        } catch {
          return new Response("Paiement momentanément indisponible.", { status: 503 });
        }
      },
    },
  },
});
