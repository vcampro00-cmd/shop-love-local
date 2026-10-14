import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULTS } from "./content.defaults";
import { numFromText } from "./content";
import { canPayInTwoTimes, computeTotals, isKnownProduct, makeOrderRef, splitPayment, type CartItem } from "./pricing";
import { createStripeClient, getStripeErrorMessage } from "./stripe.server";

const ORDER_STATUSES = ["nouveau", "prepare", "envoye", "livre", "annule"] as const;

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type Order = {
  id: string;
  ref: string;
  status: OrderRow["status"];
  created_at: string;
  name: string;
  phone: string;
  address: string;
  postal_code: string;
  notes: string | null;
  customer_email: string;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_plan: "full" | "split";
  delivery_method: "livraison" | "retrait";
  payment_status: "en_attente" | "paye" | "acompte_paye" | "echec_solde";
  amount_paid: number;
  second_amount: number;
  second_charge_due_at: string | null;
};

function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    ref: r.ref,
    status: r.status,
    created_at: r.created_at,
    name: r.name,
    phone: r.phone,
    address: r.address,
    postal_code: r.postal_code,
    notes: r.notes,
    customer_email: r.customer_email,
    items: (r.items as CartItem[] | null) ?? [],
    subtotal: Number(r.subtotal),
    delivery_fee: Number(r.delivery_fee),
    total: Number(r.total),
    payment_plan: r.payment_plan === "split" ? "split" : "full",
    delivery_method: r.delivery_method === "retrait" ? "retrait" : "livraison",
    payment_status: r.payment_status as Order["payment_status"],
    amount_paid: Number(r.amount_paid),
    second_amount: Number(r.second_amount),
    second_charge_due_at: r.second_charge_due_at,
  };
}

function emailOf(claims: unknown): string {
  return (claims as { email?: string }).email ?? "";
}

async function isAdmin(client: SupabaseClient<Database>, userId: string) {
  const { data } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Compte du visiteur connecté : e-mail + rôle administrateur. */
export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ email: string; isAdmin: boolean }> => ({
    email: emailOf(context.claims),
    isAdmin: await isAdmin(context.supabase, context.userId),
  }));

const orderPayload = z
  .object({
    name: z.string().trim().min(2, "Indiquez votre nom").max(100),
    phone: z.string().trim().min(8, "Téléphone invalide").max(20),
    address: z.string().trim().max(300).default(""),
    postal_code: z.string().trim().max(9).default(""),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(z.object({ id: z.string().max(64), qty: z.number().int().min(1).max(20) }))
      .min(1, "Votre panier est vide")
      .max(20),
    plan: z.enum(["full", "split"]).default("full"),
    delivery_method: z.enum(["livraison", "retrait"]).default("livraison"),
  })
  .superRefine((v, ctx) => {
    if (v.delivery_method !== "livraison") return;
    if (v.address.length < 8) ctx.addIssue({ code: "custom", path: ["address"], message: "Indiquez l'adresse complète" });
    if (v.postal_code.length < 4) ctx.addIssue({ code: "custom", path: ["postal_code"], message: "Code postal invalide" });
  });

/** Enregistre une commande. Les prix sont relus et recalculés ici, pas dans le navigateur. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderPayload.parse(input))
  .handler(async ({ data, context }) => {
    for (const item of data.items) {
      if (!isKnownProduct(item.id)) throw new Error("Cet article n'est plus en vente.");
    }
    // L'iPhone 7 GPS Manager se paie en une seule fois : on refuse le 2 fois côté serveur.
    if (data.plan === "split" && !canPayInTwoTimes(data.items))
      throw new Error("Cet article se paie en une seule fois.");

    const { readSiteTexts } = await import("./site-texts.server");
    const texts = await readSiteTexts();
    const priceOf = (id: string) =>
      numFromText(texts[`product.${id}.price`] ?? DEFAULTS[`product.${id}.price`] ?? "", 0);
    const fee = numFromText(texts["delivery.fee"] ?? DEFAULTS["delivery.fee"] ?? "", 0);
    const totals = computeTotals(data.items, priceOf, fee, data.delivery_method);
    if (totals.total <= 0) throw new Error("Commande impossible : vérifiez les articles du panier.");

    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const ref = makeOrderRef(Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        ref,
        customer_id: context.userId,
        customer_email: emailOf(context.claims),
        name: data.name,
        phone: data.phone,
        address: data.address,
        postal_code: data.postal_code,
        notes: data.notes || null,
        items: data.items,
        subtotal: totals.subtotal,
        delivery_fee: totals.deliveryFee,
        total: totals.total,
        payment_plan: data.plan,
        delivery_method: data.delivery_method,
        second_amount: splitPayment(totals.total, data.plan).later,
      })
      .select("id, ref")
      .single();

    if (error) throw new Error("La commande n'a pas pu être enregistrée. Réessayez.");

    // Aviso por e-mail ao proprietário — uma falha aqui nunca bloqueia o pedido.
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const eur = (cents: number) =>
        (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      await sendTemplateEmail("order-notification", "", {
        idempotencyKey: `order-notification-${order.id}`,
        templateData: {
          ref: order.ref,
          name: data.name,
          phone: data.phone,
          email: emailOf(context.claims),
          delivery:
            data.delivery_method === "retrait" ? "Retrait sur place" : "Livraison à domicile",
          address:
            data.delivery_method === "retrait"
              ? ""
              : `${data.address}, ${data.postal_code}`.trim(),
          items: data.items.map((i) => `${i.qty} × ${i.id}`).join(", "),
          total: eur(totals.total),
          plan: data.plan === "split" ? "En 2 fois" : "En une fois",
        },
      });
    } catch (e) {
      console.error("order-notification email failed", e);
    }

    return { id: order.id, ref: order.ref, total: totals.total };
  });

/** Commandes du visiteur connecté (la politique de la table ne laisse voir que les siennes). */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Impossible d'afficher vos commandes.");
    return (data ?? []).map(toOrder);
  });

/** Une commande précise : la sienne, ou n'importe laquelle pour le propriétaire. */
export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Order> => {
    const { data: row, error } = await context.supabase.from("orders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Commande introuvable.");
    return toOrder(row);
  });

/** Toutes les commandes — réservé au propriétaire. */
export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Impossible d'afficher les commandes.");
    return (data ?? []).map(toOrder);
  });

const statusPayload = z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES) });

/** Change la situation d'une commande — réservé au propriétaire. */
export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusPayload.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("La situation n'a pas pu être enregistrée.");
    return { ok: true };
  });

const envSchema = z.enum(["sandbox", "live"]);

/** Ouvre le paiement par carte d'une commande du client (montant relu en base). */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), environment: envSchema, origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { data: row } = await context.supabase.from("orders").select("*").eq("id", data.id).maybeSingle();
    if (!row || row.customer_id !== context.userId) return { error: "Commande introuvable." };
    if (row.payment_status !== "en_attente") return { error: "Cette commande est déjà payée." };
    const order = toOrder(row);
    const { now } = splitPayment(order.total, order.payment_plan);
    const origin = new URL(data.origin).origin;
    try {
      const stripe = createStripeClient(data.environment);
      const email = emailOf(context.claims);
      const found = await stripe.customers.search({ query: `metadata['userId']:'${context.userId}'`, limit: 1 });
      const customerId =
        found.data[0]?.id ??
        (await stripe.customers.create({ ...(email ? { email } : {}), metadata: { userId: context.userId } })).id;
      const split = order.payment_plan === "split";
      const label = split ? `Commande ${order.ref} — 1er paiement sur 2` : `Commande ${order.ref}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        customer: customerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(now * 100),
              product_data: { name: label },
            },
          },
        ],
        payment_method_types: ["card"],
        payment_intent_data: {
          description: label,
          metadata: { orderId: order.id },
          ...(split && { setup_future_usage: "off_session" as const }),
        },
        metadata: { orderId: order.id, userId: context.userId, plan: order.payment_plan },
        return_url: `${origin}/pedido/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Au retour du paiement : enregistre le paiement si le webhook n'est pas encore passé. */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/), environment: envSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("orders").select("id").eq("id", data.id).maybeSingle();
    if (!row) return { ok: false };
    try {
      const { applyPaidSession } = await import("./payments.server");
      await applyPaidSession(data.sessionId, data.environment);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getStripeErrorMessage(e) };
    }
  });
