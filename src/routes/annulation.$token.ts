import { createFileRoute } from "@tanstack/react-router";

// Justificatif d'annulation du 2e paiement (lien envoyé par e-mail / WhatsApp).
export const Route = createFileRoute("/annulation/$token")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.token)) return new Response("Justificatif introuvable.", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: o } = await supabaseAdmin.from("orders").select("name, ref, amount_paid, second_amount, second_cancelled_at, updated_at, payment_status").eq("cancel_token", params.token).maybeSingle();
        const { buildCancelReceiptPdf } = await import("@/lib/cancel-receipt.server");
        let logo: Uint8Array | null = null;
        try {
          const res = await fetch(`${new URL(request.url).origin}/vcampro-logo.png`);
          if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
        } catch { /* sans logo */ }
        if (!o || o.payment_status !== "solde_annule") {
          // Rappel annulé
          const { data: r } = await supabaseAdmin.from("payment_reminders").select("name, amount, cancelled_at, group_id, installment, installments").eq("cancel_token", params.token).not("cancelled_at", "is", null).maybeSingle();
          if (!r) return new Response("Justificatif introuvable.", { status: 404 });
          let paid = 0;
          if (r.group_id) {
            const { data: g } = await supabaseAdmin.from("payment_reminders").select("amount").eq("group_id", r.group_id).not("paid_at", "is", null);
            paid = (g ?? []).reduce((s, x) => s + Number(x.amount), 0);
          }
          const ref = r.installments > 1 ? `RAPPEL ${r.installment}/${r.installments}` : "RAPPEL";
          const pdf = await buildCancelReceiptPdf({ name: r.name, ref, amountPaid: paid, cancelledAmount: Number(r.amount), cancelledAt: r.cancelled_at! }, logo);
          return new Response(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="annulation-rappel.pdf"`, "Cache-Control": "private, no-store" } });
        }
        const pdf = await buildCancelReceiptPdf({ name: o.name, ref: o.ref, amountPaid: Number(o.amount_paid), cancelledAmount: Number(o.second_amount), cancelledAt: o.second_cancelled_at ?? o.updated_at }, logo);
        return new Response(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="annulation-${o.ref}.pdf"`, "Cache-Control": "private, no-store" } });
      },
    },
  },
});
