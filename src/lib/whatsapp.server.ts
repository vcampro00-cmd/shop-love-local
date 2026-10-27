import { whatsappDigits } from "./cash";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";
const SITE = "https://vcampro.shop";
const RANK: Record<string, number> = { pending: 0, failed: 0, accepted: 1, sent: 2, delivered: 3, read: 4 };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function parisDay(d: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

/** Vence hoje ou já venceu: a data-limite é hoje ou um dia anterior. */
export function isDueNow(dueDay: string, today: string): boolean {
  return dueDay <= today;
}

const euros = (n: number) => n.toFixed(2).replace(".", ",");
const frDay = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

async function sendTemplate(to: string, name: string, params: string[]): Promise<string> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const wa = process.env["WHATSAPP_API_KEY"];
  if (!lovable || !wa) throw new Error("WhatsApp non configuré");
  const res = await fetch(`${GATEWAY_URL}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": wa, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name, language: { code: "fr" }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${body}`);
  const id = JSON.parse(body)?.messages?.[0]?.id;
  if (!id) throw new Error(`WhatsApp: réponse sans id ${body}`);
  return id;
}

type Job = { kind: "rappel" | "second"; sourceId: string; phone: string; template: string; params: string[] };

/** Envoie, le jour de l'échéance, le rappel WhatsApp de chaque paiement en attente (une fois par jour et par paiement). */
export async function sendDueReminders(opts: { onlyReminderId?: string } = {}): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = await admin();
  const today = parisDay();
  const jobs: Job[] = [];

  // Envoi ciblé (création d'un rappel) : le rappel sans date part aussi tout de suite.
  const q = db.from("payment_reminders").select("id, name, phone, amount, due_date, installment, installments, group_id, group_total, charge_error").is("paid_session_id", null);
  const { data: reminders, error: e1 } = opts.onlyReminderId
    ? await q.eq("id", opts.onlyReminderId)
    : await q.lte("due_date", today);
  if (e1) throw e1;
  for (const r of reminders ?? []) {
    // Échéances suivantes d'un rappel en plusieurs fois : prélevées automatiquement, pas de message (sauf échec).
    if (r.installments > 1 && r.installment > 1 && !r.charge_error) continue;
    let amount = euros(Number(r.amount));
    if (r.installments > 1 && r.installment === 1 && r.group_id) {
      const { data: rest } = await db.from("payment_reminders").select("amount, due_date, installment").eq("group_id", r.group_id).gt("installment", 1).order("installment");
      const next = (rest ?? []).map((x) => `${euros(Number(x.amount))} € prélevé automatiquement le ${frDay(x.due_date)}`).join(", ");
      amount = `${euros(Number(r.group_total ?? r.amount))} au total, payable en ${r.installments} fois : ${euros(Number(r.amount))} € aujourd'hui, puis ${next}. À payer maintenant : ${euros(Number(r.amount))}`;
    }
    jobs.push({ kind: "rappel", sourceId: r.id, phone: r.phone, template: "vcampro_rappel_paiement", params: [r.name, amount, `${SITE}/pagar/${r.id}`] });
  }

  if (!opts.onlyReminderId) {
    const { data: orders, error: e2 } = await db.from("orders").select("id, name, phone, ref, second_amount, second_charge_due_at").eq("payment_status", "acompte_paye").not("second_charge_due_at", "is", null);
    if (e2) throw e2;
    for (const o of orders ?? []) {
      if (!isDueNow(parisDay(o.second_charge_due_at!), today)) continue;
      jobs.push({ kind: "second", sourceId: o.id, phone: o.phone, template: "vcampro_second_paiement", params: [o.name, o.ref, euros(Number(o.second_amount))] });
    }
  }

  let sent = 0, failed = 0, skipped = 0;
  for (const j of jobs) {
    const to = whatsappDigits(j.phone ?? "");
    if (to.length < 8) { skipped++; continue; }
    const { data: existing } = await db.from("whatsapp_messages").select("id, status").eq("kind", j.kind).eq("source_id", j.sourceId).eq("due_on", today).maybeSingle();
    if (existing && existing.status !== "failed") { skipped++; continue; }
    let rowId = existing?.id;
    if (!rowId) {
      const { data: ins, error } = await db.from("whatsapp_messages").insert({ kind: j.kind, source_id: j.sourceId, due_on: today, phone: to }).select("id").single();
      if (error) { skipped++; continue; } // déjà pris par un autre passage
      rowId = ins.id;
    }
    try {
      const waId = await sendTemplate(to, j.template, j.params);
      await db.from("whatsapp_messages").update({ wa_message_id: waId, status: "accepted", error: null }).eq("id", rowId);
      await reconcileStatuses(waId);
      sent++;
    } catch (e) {
      console.error("WhatsApp reminder failed", j.kind, j.sourceId, e);
      await db.from("whatsapp_messages").update({ status: "failed", error: String((e as Error).message).slice(0, 1000) }).eq("id", rowId);
      failed++;
    }
  }
  return { sent, failed, skipped };
}

/** Applique les accusés de Meta déjà reçus pour un message (dans n'importe quel ordre d'arrivée). */
export async function reconcileStatuses(waId: string): Promise<void> {
  const db = await admin();
  const { data: msg } = await db.from("whatsapp_messages").select("id, status").eq("wa_message_id", waId).maybeSingle();
  if (!msg) return;
  const { data: events } = await db.from("whatsapp_webhook_events").select("id, payload").eq("event", "whatsapp.status").contains("payload", { entry: [{ changes: [{ value: { statuses: [{ id: waId }] } }] }] });
  let best = msg.status;
  let at: string | null = null;
  let err: string | null = null;
  for (const ev of events ?? []) {
    const statuses = (ev.payload as any)?.entry?.[0]?.changes?.[0]?.value?.statuses ?? [];
    for (const s of statuses) {
      if (s.id !== waId) continue;
      if (s.status === "failed") { err = JSON.stringify(s.errors ?? []).slice(0, 1000); if (best === "accepted") { best = "failed"; at = new Date(Number(s.timestamp) * 1000).toISOString(); } continue; }
      if ((RANK[s.status] ?? -1) > (RANK[best] ?? 0)) { best = s.status; at = new Date(Number(s.timestamp) * 1000).toISOString(); }
    }
  }
  if (best !== msg.status || err) {
    await db.from("whatsapp_messages").update({ status: best, ...(at ? { status_at: at } : {}), ...(err ? { error: err } : {}) }).eq("id", msg.id);
  }
}

/** Traite un événement stocké ; idempotent. */
export async function processWebhookEvent(id: string): Promise<void> {
  const db = await admin();
  const { data: ev } = await db.from("whatsapp_webhook_events").select("*").eq("id", id).maybeSingle();
  if (!ev || ev.processed_at) return;
  try {
    if (ev.event === "whatsapp.status") {
      const statuses = (ev.payload as any)?.entry?.[0]?.changes?.[0]?.value?.statuses ?? [];
      for (const s of statuses) if (s?.id) await reconcileStatuses(s.id);
    }
    const { error } = await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", id);
    if (error) throw error;
  } catch (e) {
    await db.from("whatsapp_webhook_events").update({ processing_error: String((e as Error).message) }).eq("id", id);
    throw e;
  }
}

/** Reprend quelques événements non traités (le plus ancien d'abord, rotation par réception). */
export async function processPendingEvents(limit = 10): Promise<void> {
  const db = await admin();
  const { data } = await db.from("whatsapp_webhook_events").select("id").is("processed_at", null).order("received_at", { ascending: true }).limit(limit);
  for (const r of data ?? []) {
    try { await processWebhookEvent(r.id); } catch { /* reste en attente */ }
  }
}
