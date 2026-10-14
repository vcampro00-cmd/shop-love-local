import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULTS } from "./content.defaults";
import { numFromText } from "./content";
import { computeTotals, isKnownProduct, makeOrderRef, type CartItem } from "./pricing";

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
  };
}

function emailOf(claims: unknown): string {
  return (claims as { email?: string }).email ?? "";
}

async function isAdmin(context: { supabase: { rpc: (fn: string, args: object) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return data === true;
}

/** Compte du visiteur connecté : e-mail + rôle administrateur. */
export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ email: string; isAdmin: boolean }> => ({
    email: emailOf(context.claims),
    isAdmin: await isAdmin(context),
  }));

const orderPayload = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  phone: z.string().trim().min(8, "Téléphone invalide").max(20),
  address: z.string().trim().min(8, "Indiquez l'adresse complète").max(300),
  postal_code: z.string().trim().min(4, "Code postal invalide").max(9),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(z.object({ id: z.string().max(64), qty: z.number().int().min(1).max(20) }))
    .min(1, "Votre panier est vide")
    .max(20),
});

/** Enregistre une commande. Les prix sont relus et recalculés ici, pas dans le navigateur. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderPayload.parse(input))
  .handler(async ({ data, context }) => {
    for (const item of data.items) {
      if (!isKnownProduct(item.id)) throw new Error("Cet article n'est plus en vente.");
    }

    const { readSiteTexts } = await import("./site-texts.server");
    const texts = await readSiteTexts();
    const priceOf = (id: string) =>
      numFromText(texts[`product.${id}.price`] ?? DEFAULTS[`product.${id}.price`] ?? "", 0);
    const fee = numFromText(texts["delivery.fee"] ?? DEFAULTS["delivery.fee"] ?? "", 0);
    const totals = computeTotals(data.items, priceOf, fee);
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
    if (!(await isAdmin(context))) throw new Error("Accès réservé au propriétaire.");
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
    if (!(await isAdmin(context))) throw new Error("Accès réservé au propriétaire.");
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("La situation n'a pas pu être enregistrée.");
    return { ok: true };
  });
