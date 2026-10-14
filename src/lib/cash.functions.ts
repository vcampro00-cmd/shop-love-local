import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé au propriétaire.");
}

export type CashEntry = { id: string; date: string; label: string; amount: number };
export type CashBook = { entries: CashEntry[]; expenses: CashEntry[] };

/** Entrées = argent réellement encaissé sur les commandes ; sorties = dépenses saisies à la main. */
export const getCashBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashBook> => {
    await assertAdmin(context);
    const [orders, expenses] = await Promise.all([
      context.supabase.from("orders").select("id, ref, name, amount_paid, updated_at").gt("amount_paid", 0).order("updated_at", { ascending: false }),
      context.supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (orders.error || expenses.error) throw new Error("Impossible d'afficher la caisse.");
    return {
      entries: (orders.data ?? []).map((o: any) => ({ id: o.id, date: o.updated_at, label: `${o.ref} — ${o.name}`, amount: Number(o.amount_paid) })),
      expenses: (expenses.data ?? []).map((e: any) => ({ id: e.id, date: e.spent_on, label: e.label, amount: Number(e.amount) })),
    };
  });

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ label: z.string().trim().min(1).max(200), amount: z.number().positive().max(1_000_000), spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("expenses").insert(data);
    if (error) throw new Error("La dépense n'a pas pu être enregistrée.");
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error("La dépense n'a pas pu être supprimée.");
    return { ok: true };
  });
