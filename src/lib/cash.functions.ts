import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CashBook, CashEntry } from "@/lib/cash";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé au propriétaire.");
}

/** Entrées automatiques = paiements reçus sur les commandes ; le reste est saisi à la main. */
export const getCashBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashBook> => {
    await assertAdmin(context);
    const [orders, expenses, staff] = await Promise.all([
      context.supabase.from("orders").select("id, ref, name, amount_paid, updated_at").gt("amount_paid", 0).order("updated_at", { ascending: false }),
      context.supabase.from("expenses").select("id, label, amount, spent_on, kind, units, unit_price").order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
      context.supabase.from("employees").select("id, name, unit_price").order("created_at"),
    ]);
    if (orders.error || expenses.error || staff.error) throw new Error("Impossible d'afficher la caisse.");
    const autoEntries: CashEntry[] = (orders.data ?? []).map((o: any) => ({
      id: o.id,
      date: o.updated_at,
      label: `${o.ref} — ${o.name}`,
      amount: Number(o.amount_paid),
      kind: "auto",
    }));
    const manual: CashEntry[] = [];
    const sortieRows: CashEntry[] = [];
    const purchaseRows: CashEntry[] = [];
    const employeeRows: CashEntry[] = [];
    for (const e of expenses.data ?? []) {
      const row: CashEntry = { id: e.id, date: e.spent_on, label: e.label, amount: Number(e.amount), kind: e.kind as CashEntry["kind"], units: e.units, unitPrice: e.unit_price == null ? null : Number(e.unit_price) };
      if (e.kind === "entree") manual.push(row);
      else if (e.kind === "achat") purchaseRows.push(row);
      else if (e.kind === "salaire") employeeRows.push(row);
      else sortieRows.push(row);
    }
    const entries = [...autoEntries, ...manual].sort((a, b) => b.date.localeCompare(a.date));
    return { entries, expenses: sortieRows, purchases: purchaseRows, employees: employeeRows, staff: (staff.data ?? []).map((s: any) => ({ id: s.id, name: s.name, unitPrice: Number(s.unit_price) })) };
  });

const KINDS = z.enum(["entree", "sortie", "achat", "salaire"]);

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      label: z.string().trim().min(1).max(200),
      amount: z.number().positive().max(1_000_000),
      spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: KINDS.default("sortie"),
      employee_id: z.string().uuid().optional(),
      units: z.number().int().positive().max(100_000).optional(),
      unit_price: z.number().positive().max(1_000_000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let row: { label: string; amount: number; spent_on: string; kind: string; employee_id?: string; units?: number; unit_price?: number } = { label: data.label, amount: data.amount, spent_on: data.spent_on, kind: data.kind };
    if (data.kind === "salaire" && data.employee_id) {
      const { data: emp } = await context.supabase.from("employees").select("id, name").eq("id", data.employee_id).maybeSingle();
      if (!emp) throw new Error("Employé introuvable.");
      row = { ...row, label: emp.name, employee_id: emp.id };
    }
    const { error } = await context.supabase.from("expenses").insert(row);
    if (error) throw new Error("La ligne n'a pas pu être enregistrée.");
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error("La ligne n'a pas pu être supprimée.");
    return { ok: true };
  });

export const addEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(1).max(100), unit_price: z.number().min(0).max(1_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("employees").insert(data);
    if (error) throw new Error("L'employé n'a pas pu être ajouté.");
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("employees").delete().eq("id", data.id);
    if (error) throw new Error("L'employé n'a pas pu être supprimé.");
    return { ok: true };
  });
