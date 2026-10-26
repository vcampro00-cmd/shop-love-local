import { isVisionxCode } from "./phone";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULTS } from "./content.defaults";
import { numFromText } from "./content";
import { canPayInTwoTimes, computeTotals, makeOrderRef, secondChargeDueFrom, splitPayment, type CartItem } from "./pricing";
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
  discount: number;
  promo_code: string | null;
  payment_plan: "full" | "split";
  delivery_method: "livraison" | "retrait";
  payment_method: "carte" | "especes";
  payment_status: "en_attente" | "paye" | "acompte_paye" | "echec_solde" | "solde_annule";
  amount_paid: number;
  second_amount: number;
  second_charge_due_at: string | null;
  seller_id: string | null;
  visionx_code: string | null;
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
    discount: Number(r.discount ?? 0),
    promo_code: r.promo_code ?? null,
    payment_plan: r.payment_plan === "split" ? "split" : "full",
    delivery_method: r.delivery_method === "retrait" ? "retrait" : "livraison",
    payment_method: r.payment_method === "especes" ? "especes" : "carte",
    payment_status: r.payment_status as Order["payment_status"],
    amount_paid: Number(r.amount_paid),
    second_amount: Number(r.second_amount),
    second_charge_due_at: r.second_charge_due_at,
    seller_id: r.seller_id ?? null,
    visionx_code: r.visionx_code ?? null,
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
    phone: z.string().trim().min(8, "Téléphone invalide").max(25),
    address: z.string().trim().max(300).default(""),
    postal_code: z.string().trim().max(9).default(""),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(z.object({ id: z.string().max(64), qty: z.number().int().min(1).max(20) }))
      .min(1, "Votre panier est vide")
      .max(20),
    plan: z.enum(["full", "split"]).default("full"),
    delivery_method: z.enum(["livraison", "retrait"]).default("livraison"),
    payment_method: z.enum(["carte", "especes"]).default("carte"),
    promo_code: z.string().max(30).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payment_method === "especes" && v.delivery_method !== "retrait")
      ctx.addIssue({ code: "custom", path: ["payment_method"], message: "Le paiement en espèces se fait uniquement au retrait sur place." });
    if (v.delivery_method !== "livraison") return;
    if (v.address.length < 8) ctx.addIssue({ code: "custom", path: ["address"], message: "Indiquez l'adresse complète" });
    if (v.postal_code.length < 4) ctx.addIssue({ code: "custom", path: ["postal_code"], message: "Code postal invalide" });
  });

/** Enregistre une commande. Les prix sont relus et recalculés ici, pas dans le navigateur. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderPayload.parse(input))
  .handler(async ({ data, context }) => {
    // Prix, disponibilité et règle « une seule fois » relus dans le catalogue du propriétaire.
    const { readCatalog } = await import("./catalog.server");
    const catalog = new Map((await readCatalog()).filter((p) => p.active).map((p) => [p.id, p]));
    for (const item of data.items) {
      if (!catalog.has(item.id)) throw new Error("Cet article n'est plus en vente.");
    }
    const fullOnly = [...catalog.values()].filter((p) => p.full_payment_only).map((p) => p.id);
    if (data.plan === "split" && !canPayInTwoTimes(data.items, fullOnly))
      throw new Error("Cet article se paie en une seule fois.");

    const { readSiteTexts } = await import("./site-texts.server");
    const texts = await readSiteTexts();
    const priceOf = (id: string) => Number(catalog.get(id)?.price ?? 0);
    const fee = numFromText(texts["delivery.fee"] ?? DEFAULTS["delivery.fee"] ?? "", 0);
    const { promoInfo } = await import("./inventory.functions");
    const { normalizePromoCode } = await import("./pricing");
    const promo = data.promo_code ? normalizePromoCode(data.promo_code) : "";
    const info = promo ? await promoInfo(promo) : { valid: false, amount: 0, sellerId: null };
    if (promo && !info.valid) throw new Error("Code promo invalide.");
    const promoValue = info.amount;
    const totals = computeTotals(data.items, priceOf, fee, data.delivery_method, promoValue);
    if (totals.total <= 0) throw new Error("Commande impossible : vérifiez les articles du panier.");

    const cash = data.payment_method === "especes";
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
        discount: totals.discount,
        promo_code: promo || null,
        seller_id: info.sellerId,
        payment_plan: cash ? "full" : data.plan,
        delivery_method: data.delivery_method,
        payment_method: data.payment_method,
        second_amount: cash ? 0 : splitPayment(totals.total, data.plan).later,
      })
      .select("id, ref")
      .single();

    if (error) throw new Error("La commande n'a pas pu être enregistrée. Réessayez.");

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
      // Les commandes « en_attente » n'ont pas été payées : le client n'a pas terminé le paiement.
      // Elles n'apparaissent pas au propriétaire pour éviter de préparer un téléphone non payé.
      .in("payment_status", ["paye", "acompte_paye", "echec_solde", "solde_annule"])
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

const secondDatePayload = z.object({ id: z.string().uuid(), date: z.string().max(10) });

/** Choisit la date du 2e prélèvement d'une commande en 2 fois — réservé au propriétaire. */
export const setSecondChargeDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => secondDatePayload.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const due = secondChargeDueFrom(data.date.trim());
    if (!due) throw new Error("Date invalide.");
    const { error } = await context.supabase
      .from("orders")
      .update({ second_charge_due_at: due })
      .eq("id", data.id)
      .in("payment_status", ["en_attente", "acompte_paye"]);
    if (error) throw new Error("La date n'a pas pu être enregistrée.");
    return { ok: true, due };
  });

/** Le propriétaire renonce au 2e prélèvement : il ne sera plus tenté ni montré comme dû. */
export const cancelSecondPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { error } = await context.supabase
      .from("orders")
      .update({ payment_status: "solde_annule", second_charge_due_at: null })
      .eq("id", data.id)
      .eq("payment_plan", "split")
      .in("payment_status", ["acompte_paye", "echec_solde"]);
    if (error) throw new Error("Le 2e paiement n'a pas pu être annulé.");
    return { ok: true };
  });

const phonePayload = z.object({ id: z.string().uuid(), phone: z.string().trim().min(8, "Téléphone invalide").max(25) });

/** Le propriétaire corrige le téléphone d'un client après la commande. */
export const setOrderPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => phonePayload.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { error } = await context.supabase.from("orders").update({ phone: data.phone }).eq("id", data.id);
    if (error) throw new Error("Le téléphone n'a pas pu être enregistré.");
    return { ok: true };
  });


const visionxPayload = z.object({
  id: z.string().uuid(),
  // Les tirets d'affichage (ABCD-1234-5678) ne comptent pas dans la validation.
  code: z.string().trim().toUpperCase().refine((v) => isVisionxCode(v.replace(/-/g, "")), "Le code VISIONX est invalide."),
});

/** Le propriétaire enregistre le code VISIONX d'une commande payée en 2 fois. */
export const setOrderVisionx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => visionxPayload.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { error } = await context.supabase.from("orders").update({ visionx_code: data.code }).eq("id", data.id).eq("payment_plan", "split");
    if (error) throw new Error("Le code n'a pas pu être enregistré.");
    return { ok: true };
  });

const actionPayload = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "refuse", "ready", "delete"]),
  message: z.string().trim().max(3000).optional(),
});

/** Actions du propriétaire sur une commande, avec e-mail au client. */
export const orderAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actionPayload.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; emailed: boolean }> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Accès réservé au propriétaire.");
    const { data: row } = await context.supabase.from("orders").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Commande introuvable.");

    if (data.action === "delete") {
      const { error } = await context.supabase.from("orders").delete().eq("id", data.id);
      if (error) throw new Error("La commande n'a pas pu être supprimée.");
      return { ok: true, emailed: false };
    }

    const status = data.action === "accept" ? "prepare" : data.action === "refuse" ? "annule" : null;
    if (status) {
      const { error } = await context.supabase.from("orders").update({ status }).eq("id", data.id);
      if (error) throw new Error("La situation n'a pas pu être enregistrée.");
    }

    const kind = data.action === "accept" ? "accepted" : data.action === "refuse" ? "refused" : "ready";
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const r = await sendTemplateEmail("order-update", row.customer_email, {
        idempotencyKey: `order-update-${kind}-${row.id}-${Date.now()}`,
        templateData: { kind, ref: row.ref, name: row.name, message: data.message ?? "" },
      });
      return { ok: true, emailed: r.sent };
    } catch (e) {
      console.error("order-update email failed", e);
      return { ok: true, emailed: false };
    }
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
    if (order.payment_method === "especes") return { error: "Cette commande se paie en espèces au retrait." };
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
