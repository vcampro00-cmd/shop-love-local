import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type CashBook, type CashEntry, type Reminder } from "@/lib/cash";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

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
      context.supabase.from("orders").select("id, ref, name, amount_paid, total, status, updated_at, payment_method").or("amount_paid.gt.0,status.eq.livre").order("updated_at", { ascending: false }),
      context.supabase.from("expenses").select("id, label, amount, spent_on, kind, employee_id, units, unit_price, order_id, created_at, on_credit, purchase_id").order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
      context.supabase.from("employees").select("id, name, unit_price").order("created_at"),
    ]);
    if (orders.error || expenses.error || staff.error) throw new Error("Impossible d'afficher la caisse.");
    // A concluded sale ("livre") counts in full, even when paid on site at pickup.
    // Cash sales count only once concluded, minus the seller's commission recorded for that order.
    const commissionByOrder = new Map<string, number>();
    for (const e of expenses.data ?? []) if (e.kind === "salaire" && e.order_id) commissionByOrder.set(e.order_id, (commissionByOrder.get(e.order_id) ?? 0) + Number(e.amount));
    const autoEntries: CashEntry[] = (orders.data ?? [])
      .filter((o: any) => o.payment_method !== "especes" || o.status === "livre")
      .map((o: any) => {
        const cash = o.payment_method === "especes";
        return {
          id: o.id,
          date: o.updated_at,
          label: `${o.ref} — ${o.name}`,
          // Seller commissions are tracked per seller only; they are never deducted from sales.
          amount: cash ? Number(o.total) : o.status === "livre" ? Math.max(Number(o.total), Number(o.amount_paid)) : Number(o.amount_paid),
          kind: cash ? "especes" : "auto",
          createdAt: o.updated_at,
        };
      });
    const manual: CashEntry[] = [];
    const sortieRows: CashEntry[] = [];
    const purchaseRows: CashEntry[] = [];
    const employeeRows: CashEntry[] = [];
    let drawer: CashBook["drawer"] = null;
    const repayments: CashEntry[] = [];
    for (const e of expenses.data ?? []) {
      if (e.kind === "fond") {
        if (!drawer || e.created_at > drawer.setAt) drawer = { amount: Number(e.amount), setAt: e.created_at };
        continue;
      }
      // Salary rows are grouped by employee name, so commissions use the seller's name.
      const empName = e.kind === "salaire" && e.employee_id ? (staff.data ?? []).find((x: any) => x.id === e.employee_id)?.name : undefined;
      const row: CashEntry = { id: e.id, date: e.spent_on, label: empName ?? e.label, amount: Number(e.amount), kind: e.kind as CashEntry["kind"], units: e.units, unitPrice: e.unit_price == null ? null : Number(e.unit_price), createdAt: e.created_at, onCredit: Boolean(e.on_credit), purchaseId: e.purchase_id ?? null, orderId: e.order_id ?? null };
      if (e.kind === "remboursement") repayments.push(row);
      else if (e.kind === "entree") manual.push(e.on_credit ? { ...row, kind: "especes", manual: true } : { ...row, manual: true });
      else if (e.kind === "achat") purchaseRows.push(row);
      else if (e.kind === "salaire") employeeRows.push(row);
      else sortieRows.push(row);
    }
    const entries = [...autoEntries, ...manual].sort((a, b) => b.date.localeCompare(a.date));
    return { entries, expenses: sortieRows, purchases: purchaseRows, employees: employeeRows, staff: (staff.data ?? []).map((s: any) => ({ id: s.id, name: s.name, unitPrice: Number(s.unit_price) })), drawer, repayments };
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
      on_credit: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let row: { label: string; amount: number; spent_on: string; kind: string; employee_id?: string; units?: number; unit_price?: number; on_credit?: boolean } = { label: data.label, amount: data.amount, spent_on: data.spent_on, kind: data.kind, on_credit: (data.kind === "achat" || data.kind === "entree") && data.on_credit === true };
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

// ---- Rappels de paiement (envoyés à la main via le WhatsApp du propriétaire) ----

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Reminder[]> => {
    await assertAdmin(context);
    // Paid reminders disappear; the rest are sorted by due date (soonest first, undated last).
    const { data, error } = await context.supabase.from("payment_reminders").select("id, name, phone, amount, note, due_date, payment_link, created_at, paid_session_id").is("paid_session_id", null).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
    if (error) throw new Error("Impossible d'afficher les rappels.");
    const manual: Reminder[] = (data ?? []).map((r: any) => ({ id: r.id, name: r.name, phone: r.phone, amount: Number(r.amount), note: r.note ?? "", dueDate: r.due_date ?? null, paymentLink: r.payment_link, paid: Boolean(r.paid_session_id), createdAt: r.created_at }));
    // Second instalments of site orders: read-only, dated on the automatic charge day, gone once paid.
    const { data: orders } = await context.supabase.from("orders").select("id, ref, name, phone, second_amount, second_charge_due_at, payment_status, created_at").in("payment_status", ["acompte_paye", "echec_solde"]);
    const paris = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
    const fromOrders: Reminder[] = (orders ?? []).map((o: any) => ({ id: o.id, name: o.name, phone: o.phone ?? "", amount: Number(o.second_amount), note: `Commande ${o.ref} — 2e paiement${o.payment_status === "echec_solde" ? " (échec du prélèvement)" : ""}`, dueDate: o.second_charge_due_at ? paris(o.second_charge_due_at) : null, paymentLink: null, paid: false, createdAt: o.created_at, fromOrder: true }));
    return [...manual, ...fromOrders].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  });

export const addReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(100),
      phone: z.string().trim().min(6).max(20),
      amount: z.number().positive().max(1_000_000),
      note: z.string().trim().max(300).default(""),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("payment_reminders").insert({ name: data.name, phone: data.phone, amount: data.amount, note: data.note, due_date: data.dueDate });
    if (error) throw new Error("Le rappel n'a pas pu être enregistré.");
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("payment_reminders").delete().eq("id", data.id);
    if (error) throw new Error("Le rappel n'a pas pu être supprimé.");
    return { ok: true };
  });

/** Crée (ou renvoie) le lien de paiement par carte du rappel, au montant exact saisi. */
export const createReminderLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), origin: z.string().url() }).parse(i))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    await assertAdmin(context);
    const { data: row } = await context.supabase.from("payment_reminders").select("id").eq("id", data.id).maybeSingle();
    if (!row) return { error: "Rappel introuvable." };
    // Lien court sur le site ; la page /pagar ouvre le paiement Stripe au montant enregistré.
    return { url: `${new URL(data.origin).origin}/pagar/${row.id}` };
  });

/** Le propriétaire compte l'argent en caisse ; les ventes en espèces conclues ensuite s'y ajoutent. */
export const setCashDrawer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ amount: z.number().min(0).max(1_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("expenses").insert({ label: "Argent en caisse", amount: data.amount, spent_on: new Date().toISOString().slice(0, 10), kind: "fond" });
    if (error) throw new Error("Le montant n'a pas pu être enregistré.");
    return { ok: true };
  });

/** Rembourse une partie (ou tout) d'un achat de téléphones pris à crédit. */
export const payDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ purchaseId: z.string().uuid(), amount: z.number().positive().max(1_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: p } = await context.supabase.from("expenses").select("id, label, amount, kind, on_credit").eq("id", data.purchaseId).maybeSingle();
    if (!p || p.kind !== "achat" || !p.on_credit) throw new Error("Achat à crédit introuvable.");
    const { data: paidRows } = await context.supabase.from("expenses").select("amount").eq("purchase_id", p.id).eq("kind", "remboursement");
    const remaining = Number(p.amount) - (paidRows ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    if (data.amount > Math.round(remaining * 100) / 100) throw new Error("Le montant dépasse ce qui reste à payer.");
    const { error } = await context.supabase.from("expenses").insert({ label: `Remboursement — ${p.label}`, amount: data.amount, spent_on: new Date().toISOString().slice(0, 10), kind: "remboursement", purchase_id: p.id });
    if (error) throw new Error("Le paiement n'a pas pu être enregistré.");
    return { ok: true };
  });

/** Corrige le dernier montant saisi (faute de frappe) sans perdre les mouvements faits depuis. */
export const correctCashDrawer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ amount: z.number().min(0).max(1_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: last } = await context.supabase.from("expenses").select("id, spent_on, created_at").eq("kind", "fond").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) throw new Error("Aucun montant à corriger.");
    const { error } = await context.supabase.from("expenses").insert({ label: "Argent en caisse", amount: data.amount, spent_on: last.spent_on, kind: "fond", created_at: last.created_at });
    if (error) throw new Error("Le montant n'a pas pu être corrigé.");
    await context.supabase.from("expenses").delete().eq("id", last.id);
    return { ok: true };
  });
