import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import { SECOND_CHARGE_DELAY_DAYS } from "./pricing";

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
    const env = (o.payment_env === "live" ? "live" : "sandbox") as StripeEnv;
    const amount = Math.round(Number(o.second_amount) * 100);
    try {
      if (!o.stripe_customer_id || !o.stripe_payment_method_id || amount < 50) throw new Error("Carte manquante");
      const stripe = createStripeClient(env);
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
        { idempotencyKey: `order-${o.id}-second` },
      );
      if (pi.status !== "succeeded") throw new Error(`Statut ${pi.status}`);
      await db
        .from("orders")
        .update({ payment_status: "paye", amount_paid: Number(o.total), second_charge_due_at: null })
        .eq("id", o.id)
        .eq("payment_status", "acompte_paye");
      charged++;
    } catch (e) {
      console.error("Second charge failed", o.id, getStripeErrorMessage(e));
      await db.from("orders").update({ payment_status: "echec_solde" }).eq("id", o.id).eq("payment_status", "acompte_paye");
      failed++;
    }
  }
  return { charged, failed };
}

/**
 * Paiement d'un rappel (lien court /pagar/<id>) : marque le rappel payé
 * et crédite la caisse d'une entrée automatique, une seule fois.
 */
export async function applyPaidReminder(sessionId: string, env: StripeEnv): Promise<void> {
  const stripe = createStripeClient(env);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const reminderId = session.metadata?.['reminderId'];
  if (!reminderId || session.payment_status !== "paid") return;

  const db = await admin();
  // Claim idempotent : on marque le rappel payé une seule fois.
  const { data, error } = await db
    .from("payment_reminders")
    .update({ paid_session_id: session.id, paid_at: new Date().toISOString() })
    .eq("id", reminderId)
    .is("paid_session_id", null)
    .select("id, name");
  if (error || !data?.length) return; // déjà traité ou rappel supprimé

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
}
