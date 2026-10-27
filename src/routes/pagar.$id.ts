import { createFileRoute } from "@tanstack/react-router";

// Lien court envoyé sur WhatsApp : vcampro.shop/pagar/<id du rappel>.
// Le montant vient toujours du rappel enregistré, jamais de l'URL.
// Rappel en plusieurs fois : le client accepte d'abord le contrat, puis la carte est gardée
// pour prélever automatiquement les échéances suivantes.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const frDay = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

async function loadRow(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("payment_reminders")
    .select("id, name, amount, group_id, group_total, installment, installments, paid_session_id, contract_lang")
    .eq("id", id).maybeSingle();
  if (!row) return null;
  const rest = row.group_id && row.installments > 1 && row.installment === 1
    ? ((await supabaseAdmin.from("payment_reminders").select("amount, due_date, installment").eq("group_id", row.group_id).gt("installment", 1).order("installment")).data ?? [])
    : [];
  return { row, rest, db: supabaseAdmin };
}

async function texts() {
  const { DEFAULTS } = await import("@/lib/content.defaults");
  let saved: Record<string, string> = {};
  try { saved = await (await import("@/lib/site-texts.server")).readSiteTexts(); } catch { /* défauts */ }
  return (k: string) => (saved[k]?.trim() ? saved[k]! : DEFAULTS[k] ?? "");
}

function contractPage(tr: (k: string) => string, row: { name: string; amount: number; group_total: number | null; installments: number; contract_lang: string }, rest: { amount: number; due_date: string | null }[], error = false) {
  const pt = row.contract_lang === "pt";
  const PT: Record<string, string> = { "rappelContract.title": "rappelContract.ptTitle", "rappelContract.body": "rappelContract.ptBody", "rappelContract.accept": "rappelContract.ptAccept", "rappelContract.button": "rappelContract.ptButton", "rappelContract.warning": "rappelContract.ptWarning" };
  const t = (k: string) => tr(pt ? PT[k] ?? k : k);
  const L = pt
    ? { today: "HOJE", auto: "DEBITADO AUTOMATICAMENTE EM", total: "VALOR TOTAL", times: "VEZES", err: "MARQUE A CAIXA PARA ACEITAR O CONTRATO.", lang: "pt" }
    : { today: "AUJOURD'HUI", auto: "PRÉLEVÉ AUTOMATIQUEMENT LE", total: "MONTANT TOTAL", times: "FOIS", err: "${L.err}", lang: "fr" };
  const total = Number(row.group_total ?? row.amount);
  const lines = [`<li><b>${eur(Number(row.amount))}</b> — ${L.today}</li>`, ...rest.map((r) => `<li><b>${eur(Number(r.amount))}</b> — ${L.auto} ${frDay(r.due_date)}</li>`)].join("");
  return `<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrat — Vcampro</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#000;color:#f4ecff;font-family:system-ui,sans-serif;text-transform:uppercase}main{max-width:560px;margin:0 auto;padding:32px 18px}h1{font-size:20px;color:#e04dff}.box{border:1px solid #3a2350;background:#0d0614;border-radius:14px;padding:18px;margin:16px 0}p{line-height:1.5;font-size:14px}ul{padding-left:18px;line-height:1.8}label{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:16px 0}input{width:20px;height:20px;accent-color:#e04dff}button{width:100%;padding:16px;border:0;border-radius:12px;background:linear-gradient(90deg,#8b2cff,#e04dff);color:#fff;font-weight:800;font-size:16px;text-transform:uppercase}.err{color:#ff5d6c;font-weight:700}</style></head>
<body><main><h1>VCAMPRO</h1><p>${esc(row.name)}</p>
<div class="box" style="border-color:#ff5d6c"><p class="err" style="font-size:17px;margin:0">⚠ ${esc(t("rappelContract.warning"))}</p></div>
<div class="box"><p>${L.total} : <b>${eur(total)}</b> — ${row.installments} ${L.times} :</p><ul>${lines}</ul></div>
<div class="box"><h2 style="font-size:16px">${esc(t("rappelContract.title"))}</h2><p>${esc(t("rappelContract.body"))}</p></div>
<form method="post">${error ? `<p class="err">${L.err}</p>` : ""}
<label><input type="checkbox" name="accept" value="1" required> ${esc(t("rappelContract.accept"))}</label>
<button type="submit">${esc(t("rappelContract.button"))} — ${eur(Number(row.amount))}</button></form></main></body></html>`;
}

const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

async function checkout(request: Request, row: { id: string; name: string; amount: number; installments: number; installment: number; group_total: number | null }) {
  const origin = new URL(request.url).origin;
  const { createStripeClient } = await import("@/lib/stripe.server");
  const host = new URL(request.url).hostname;
  // Real money on the published site; test mode only in the preview / local dev.
  const isTest = host === "localhost" || host.includes("preview") || host.endsWith("-dev.lovable.app");
  const stripe = createStripeClient(isTest ? "sandbox" : "live");
  const multi = row.installments > 1 && row.installment === 1;
  const label = multi
    ? `Paiement 1/${row.installments} (total ${eur(Number(row.group_total ?? row.amount))}, suite prélevée automatiquement) — ${row.name}`
    : `Paiement convenu — ${row.name}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(Number(row.amount) * 100), product_data: { name: label } } }],
    payment_method_types: ["card"],
    ...(multi && { customer_creation: "always" as const }),
    payment_intent_data: { description: label, ...(multi && { setup_future_usage: "off_session" as const }) },
    // Relie la session au rappel : le webhook crédite la caisse au paiement.
    metadata: { reminderId: row.id },
    success_url: `${origin}/paiement-recu?paiement=ok`,
    cancel_url: `${origin}/paiement-recu?paiement=annule`,
  });
  if (!session.url) return new Response("Paiement indisponible.", { status: 503 });
  return Response.redirect(session.url, 303);
}

export const Route = createFileRoute("/pagar/$id")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const origin = new URL(request.url).origin;
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return Response.redirect(`${origin}/`, 302);
        const found = await loadRow(params.id);
        if (!found) return new Response("Lien de paiement introuvable.", { status: 404 });
        if (found.row.paid_session_id) return Response.redirect(`${origin}/paiement-recu?paiement=ok`, 302);
        if (found.row.installments > 1 && found.row.installment === 1) {
          return html(contractPage(await texts(), found.row, found.rest));
        }
        try { return await checkout(request, found.row); }
        catch { return new Response("Paiement momentanément indisponible.", { status: 503 }); }
      },
      POST: async ({ params, request }) => {
        const origin = new URL(request.url).origin;
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return Response.redirect(`${origin}/`, 302);
        const found = await loadRow(params.id);
        if (!found) return new Response("Lien de paiement introuvable.", { status: 404 });
        if (found.row.paid_session_id) return Response.redirect(`${origin}/paiement-recu?paiement=ok`, 303);
        const form = await request.formData().catch(() => null);
        if (form?.get("accept") !== "1") return html(contractPage(await texts(), found.row, found.rest, true));
        await found.db.from("payment_reminders").update({ contract_accepted_at: new Date().toISOString() }).eq("id", found.row.id);
        try { return await checkout(request, found.row); }
        catch { return new Response("Paiement momentanément indisponible.", { status: 503 }); }
      },
    },
  },
});
