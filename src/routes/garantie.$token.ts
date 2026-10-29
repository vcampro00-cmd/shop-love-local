import { createFileRoute } from "@tanstack/react-router";

// Certificat de garantie en PDF, ouvert depuis le bouton du message WhatsApp.
export const Route = createFileRoute("/garantie/$token")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.token)) return new Response("Garantie introuvable.", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: r } = await supabaseAdmin.from("payment_reminders").select("id, name, amount, warranty_months, paid_at").eq("warranty_token", params.token).maybeSingle();
        if (!r || !r.warranty_months || !r.paid_at) return new Response("Garantie introuvable.", { status: 404 });
        const { buildWarrantyPdf } = await import("@/lib/warranty.server");
        let logo: Uint8Array | null = null;
        try {
          const res = await fetch(`${new URL(request.url).origin}/vcampro-logo.png`);
          if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
        } catch { /* sans logo */ }
        const pdf = await buildWarrantyPdf({ name: r.name, amount: Number(r.amount), months: r.warranty_months, paidAt: r.paid_at, ref: r.id }, logo);
        return new Response(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="garantie-vcampro.pdf"`, "Cache-Control": "private, no-store" } });
      },
    },
  },
});
