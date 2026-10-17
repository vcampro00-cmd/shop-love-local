import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { commissionFor, normalizePromoCode, type CartItem } from "./pricing";

async function assertAdmin(client: any, userId: string) {
  const { data } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé au propriétaire.");
}

/** Stock de chaque téléphone + codes promo — propriétaire seulement. */
export const getInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [stock, promos, staff, cat] = await Promise.all([
      context.supabase.from("product_stock").select("product_id, quantity"),
      context.supabase.from("promo_codes").select("code, amount, active").order("created_at"),
      context.supabase.from("employees").select("id, name").order("created_at"),
      context.supabase.from("catalog_products").select("id").eq("active", true).order("sort").order("created_at"),
    ]);
    const map = new Map((stock.data ?? []).map((r) => [r.product_id, r.quantity]));
    return {
      stock: (cat.data ?? []).map(({ id }) => ({ id, quantity: map.get(id) ?? 0 })),
      promos: (promos.data ?? []).map((p) => ({ code: p.code, amount: Number(p.amount), active: p.active })),
      sellers: (staff.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    };
  });

export const setStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().min(1).max(64), quantity: z.number().int().min(0).max(100000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("product_stock")
      .upsert({ product_id: data.id, quantity: data.quantity, updated_at: new Date().toISOString() });
    if (error) throw new Error("Le stock n'a pas pu être enregistré.");
    return { ok: true };
  });

export const addPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ code: z.string().min(2).max(30), amount: z.number().positive().max(10000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const code = normalizePromoCode(data.code);
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) throw new Error("Code invalide (lettres et chiffres).");
    const { error } = await context.supabase.from("promo_codes").upsert({ code, amount: data.amount, active: true });
    if (error) throw new Error("Le code n'a pas pu être enregistré.");
    return { ok: true };
  });

export const deletePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().max(30) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("promo_codes").delete().eq("code", data.code);
    return { ok: true };
  });

/** Montant de réduction d'un code promo actif (0 si inconnu). Utilisé aussi par createOrder. */
export async function promoAmount(code: string): Promise<number> {
  const c = normalizePromoCode(code);
  if (!c) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("promo_codes").select("amount").eq("code", c).eq("active", true).maybeSingle();
  return data ? Number(data.amount) : 0;
}

/** Vérifie un code promo saisi dans le panier. */
export const checkPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().max(30) }).parse(i))
  .handler(async ({ data }) => {
    const amount = await promoAmount(data.code);
    return { code: normalizePromoCode(data.code), amount };
  });

/**
 * Conclut la vente : commande « livrée », stock diminué, commission du vendeur
 * enregistrée dans la Caisse (une seule fois par commande).
 */
export const concludeSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), sellerId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: order } = await sb.from("orders").select("id, ref, status, items").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Commande introuvable.");
    if (order.status === "livre") throw new Error("Cette vente est déjà conclue.");
    const { data: emp } = await sb.from("employees").select("id, name").eq("id", data.sellerId).maybeSingle();
    if (!emp) throw new Error("Vendeur introuvable.");

    const items = ((order.items as CartItem[] | null) ?? []).filter((i) => i && typeof i.qty === "number");
    const { error } = await sb.from("orders").update({ status: "livre", seller_id: emp.id }).eq("id", order.id);
    if (error) throw new Error("La vente n'a pas pu être conclue.");

    const { data: stock } = await sb.from("product_stock").select("product_id, quantity");
    const { data: cat } = await sb.from("catalog_products").select("id, commission");
    const commissions = new Map((cat ?? []).map((c) => [c.id, Number(c.commission)]));
    const map = new Map((stock ?? []).map((r) => [r.product_id, r.quantity]));
    for (const it of items) {
      if (!commissions.has(it.id)) continue;
      const q = Math.max(0, (map.get(it.id) ?? 0) - it.qty);
      map.set(it.id, q);
      await sb.from("product_stock").upsert({ product_id: it.id, quantity: q, updated_at: new Date().toISOString() });
    }

    const commission = commissionFor(items, (id) => commissions.get(id) ?? 0);
    if (commission > 0) {
      await sb.from("expenses").insert({
        kind: "salaire",
        employee_id: emp.id,
        order_id: order.id,
        label: `${emp.name} — commission ${order.ref}`,
        amount: commission,
        spent_on: new Date().toISOString().slice(0, 10),
      });
    }
    return { ok: true, commission, seller: emp.name };
  });
