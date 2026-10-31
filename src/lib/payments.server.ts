import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import { SECOND_CHARGE_DELAY_DAYS, secondPaymentKey } from "./pricing";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Enregistre un paiement Stripe réussi sur la commande (idempotent).
 * Paiement complet → « payé ». En 2 fois → « acompte payé » + carte gardée
 * pour le 2e prélèvement, 7 jours plus tard.
 */
export async function applyPaidSession(sessionId: string, env: StripeEnv): Promise<void> {
  const stripe = createStripeClient(env);
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  if (session.payment_status !== "paid") return;
  const orderId = session.metadata?.['orderId'];
  if (!orderId) return;

  const db = await admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.payment_status !== "en_attente") return;

  const paidNow = (session.amount_total ?? 0) / 100;
  const pi = session.payment_intent as { payment_method?: string | { id: string } | null } | null;
  const pm = typeof pi?.payment_method === "string" ? pi.payment_method : pi?.payment_method?.id ?? null;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  if (order.payment_plan === "split" && Number(order.second_amount) > 0) {
    // Date déjà choisie par le propriétaire ? On la garde, sinon 7 jours plus tard.
    const due = order.second_charge_due_at ?? new Date(Date.now() + SECOND_CHARGE_DELAY_DAYS * 86400_000).toISOString();
    await db
      .from("orders")
      .update({
        payment_status: "acompte_paye",
        amount_paid: paidNow,
        second_charge_due_at: due,
        stripe_customer_id: customer,
        stripe_payment_method_id: pm,
        payment_env: env,
      })
      .eq("id", orderId)
      .eq("payment_status", "en_attente");
  } else {
    await db
      .from("orders")
      .update({ payment_status: "paye", amount_paid: paidNow, stripe_customer_id: customer, payment_env: env })
      .eq("id", orderId)
      .eq("payment_status", "en_attente");
  }

  // E-mail ao proprietário — enviado somente agora, depois da confirmação do pagamento.
  try {
    const { readCatalog } = await import("./catalog.server");
    const catalog = new Map((await readCatalog()).map((p) => [p.id, p]));
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const eur = (euros: number) =>
      Number(euros).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    await sendTemplateEmail("order-notification", "", {
      idempotencyKey: `order-notification-${order.id}`,
      templateData: {
        ref: order.ref,
        name: order.name,
        phone: order.phone,
        email: order.customer_email,
        delivery: order.delivery_method === "retrait" ? "Retrait sur place" : "Livraison à domicile",
        address:
          order.delivery_method === "retrait"
            ? ""
            : `${order.address ?? ""}, ${order.postal_code ?? ""}`.trim(),
        items: ((order.items ?? []) as { id: string; qty: number }[])
          .map((i) => `${i.qty} × ${catalog.get(i.id)?.name ?? i.id}`)
          .join(", "),
        total: eur(order.total),
        plan: order.payment_plan === "split" ? "En 2 fois" : "En une fois",
      },
    });
  } catch (e) {
    console.error("order-notification email failed", e);
  }
}

type OrderRow = import("@/integrations/supabase/types").Database["public"]["Tables"]["orders"]["Row"];

/**
 * Prélève le 2e paiement d'une commande. Même clé d'idempotence pour le
 * prélèvement auto et le bouton manuel : Stripe ne débite jamais deux fois.
 * Une fois payé, la commande passe « payé » et le cron ne la reprend plus.
 */
async function chargeOrderSecond(o: OrderRow, retry = false): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await admin();
  const env = (o.payment_env === "live" ? "live" : "sandbox") as StripeEnv;
  const amount = Math.round(Number(o.second_amount) * 100);
  try {
    if (!o.stripe_customer_id || !o.stripe_payment_method_id || amount < 50) throw new Error("Carte manquante");
    const stripe = createStripeClient(env);
    const baseKey = secondPaymentKey(o.id, o.second_charge_due_at);
    const key = retry ? `${baseKey}-retry-${Math.floor(Date.now() / 60000)}` : baseKey;
    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: "eur",
        customer: o.stripe_customer_id,
        payment_method: o.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Commande ${o.ref} — 2e paiement`,
        metadata: { orderId: o.id, installment: "2" },
      },
      { idempotencyKey: key },
    );
    if (pi.status !== "succeeded") throw new Error(`Statut ${pi.status}`);
    await db
      .from("orders")
      .update({ payment_status: "paye", amount_paid: Number(o.total), second_charge_due_at: null })
      .eq("id", o.id)
      .in("payment_status", ["acompte_paye", "echec_solde"]);
    return { ok: true };
  } catch (e) {
    const reason = getStripeErrorMessage(e);
    console.error("Second charge failed", o.id, reason);
    await db.from("orders").update({ payment_status: "echec_solde" }).eq("id", o.id).eq("payment_status", "acompte_paye");
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("second-payment-failed", "", {
        idempotencyKey: `second-payment-failed-${o.id}${retry ? `-${Date.now()}` : ""}`,
        templateData: { ref: o.ref, name: o.name, phone: o.phone, amount: `${Number(o.second_amount).toFixed(2).replace(".", ",")} €`, reason },
      });
    } catch (err) {
      console.error("second-payment-failed email failed", err);
    }
    return { ok: false, reason };
  }
}

/** Bouton « Prélever maintenant » du propriétaire (rôle vérifié par l'appelant). */
export async function chargeSecondNow(orderId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await admin();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!o || o.payment_plan !== "split") return { ok: false, reason: "Commande introuvable." };
  if (o.payment_status === "paye") return { ok: false, reason: "Déjà payé." };
  if (o.payment_status !== "acompte_paye" && o.payment_status !== "echec_solde") return { ok: false, reason: "Rien à prélever." };
  return chargeOrderSecond(o, o.payment_status === "echec_solde");
}

/** Prélève le 2e paiement des commandes arrivées à échéance. Une seule fois par commande. */
export async function chargeDueInstallments(): Promise<{ charged: number; failed: number }> {
  const db = await admin();
  const { data: due } = await db
    .from("orders")
    .select("*")
    .eq("payment_status", "acompte_paye")
    .lte("second_charge_due_at", new Date().toISOString())
    .limit(50);

  let charged = 0;
  let failed = 0;
  for (const o of due ?? []) {
    const r = await chargeOrderSecond(o);
    if (r.ok) charged++;
    else failed++;
  }
  return { charged, failed };
}

/**
 * Paiement d'un rappel (lien court /pagar/<id>) : marque le rappel payé
 * et crédite la caisse d'une entrée automatique, une seule fois.
 */
export async function applyPaidReminder(sessionId: string, env: StripeEnv): Promise<void> {
  const stripe = createStripeClient(env);
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  const reminderId = session.metadata?.['reminderId'];
  if (!reminderId || session.payment_status !== "paid") return;

  const db = await admin();
  // Claim idempotent : on marque le rappel payé une seule fois.
  const { data, error } = await db
    .from("payment_reminders")
    .update({ paid_session_id: session.id, paid_at: new Date().toISOString() })
    .eq("id", reminderId)
    .is("paid_session_id", null)
    .select("id, name, group_id, installment, installments");
  if (error || !data?.length) return; // déjà traité ou rappel supprimé

  // 1re échéance d'un rappel en plusieurs fois : la carte est gardée pour les suivantes.
  const r0 = data[0]!;
  if (r0.group_id && r0.installments > 1 && r0.installment === 1) {
    const pi = session.payment_intent as { payment_method?: string | { id: string } | null } | null;
    const pm = typeof pi?.payment_method === "string" ? pi.payment_method : pi?.payment_method?.id ?? null;
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    await db.from("payment_reminders")
      .update({ stripe_customer_id: customer, stripe_payment_method_id: pm, payment_env: env })
      .eq("group_id", r0.group_id).gt("installment", 1);
  }

  const amount = Math.round((session.amount_total ?? 0)) / 100;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { error: ins } = await db.from("expenses").insert({
    label: `Paiement convenu — ${data[0]!.name}`,
    amount,
    kind: "auto",
    spent_on: today,
  });
  if (ins) console.error("Cash entry for reminder payment failed", ins);
  // Garantie de programmation demandée par le propriétaire : envoyée au paiement.
  try { await (await import("./warranty.server")).sendWarranty(reminderId); } catch (e) { console.error("Warranty failed", e); }
}

/** Prélève automatiquement les échéances suivantes des rappels en plusieurs fois (une tentative par échéance). */
export async function chargeDueReminderInstallments(): Promise<{ charged: number; failed: number }> {
  const db = await admin();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: due } = await db
    .from("payment_reminders")
    .select("*")
    .is("paid_session_id", null)
    .is("charge_error", null)
    .gt("installment", 1)
    .not("stripe_payment_method_id", "is", null)
    .lte("due_date", today)
    .limit(50);
  let charged = 0, failed = 0;
  for (const r of due ?? []) {
    const env = (r.payment_env === "live" ? "live" : "sandbox") as StripeEnv;
    try {
      const stripe = createStripeClient(env);
      const pi = await stripe.paymentIntents.create(
        {
          amount: Math.round(Number(r.amount) * 100), currency: "eur",
          customer: r.stripe_customer_id!, payment_method: r.stripe_payment_method_id!,
          off_session: true, confirm: true,
          description: `Paiement ${r.installment}/${r.installments} — ${r.name}`,
          metadata: { reminderId: r.id, installment: String(r.installment) },
        },
        { idempotencyKey: `reminder-${r.id}-charge` },
      );
      if (pi.status !== "succeeded") throw new Error(`Statut ${pi.status}`);
      const { data: claimed } = await db.from("payment_reminders")
        .update({ paid_session_id: pi.id, paid_at: new Date().toISOString() })
        .eq("id", r.id).is("paid_session_id", null).select("id");
      if (claimed?.length) {
        await db.from("expenses").insert({ label: `Paiement convenu ${r.installment}/${r.installments} — ${r.name}`, amount: Number(r.amount), kind: "auto", spent_on: today });
      }
      charged++;
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      console.error("Reminder installment charge failed", r.id, reason);
      await db.from("payment_reminders").update({ charge_error: reason || "échec" }).eq("id", r.id);
      failed++;
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("second-payment-failed", "", {
          idempotencyKey: `reminder-charge-failed-${r.id}`,
          templateData: { ref: `Rappel ${r.installment}/${r.installments}`, name: r.name, phone: r.phone, amount: `${Number(r.amount).toFixed(2).replace(".", ",")} €`, reason },
        });
      } catch (err) {
        console.error("reminder-charge-failed email failed", err);
      }
    }
  }
  return { charged, failed };
}
