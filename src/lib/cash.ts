export type CashEntryKind = "auto" | "especes" | "entree" | "sortie" | "achat" | "salaire" | "remboursement";

export type CashEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  kind: CashEntryKind;
  units?: number | null;
  unitPrice?: number | null;
  /** Moment exact de la saisie (pour l'argent en caisse). */
  createdAt?: string;
  /** Achat de téléphones payé à crédit (fiado) : ne sort pas de la caisse tout de suite. */
  onCredit?: boolean;
  /** Remboursement : achat à crédit qu'il rembourse. */
  purchaseId?: string | null;
  /** Commande liée (commission automatique d'une vente). */
  orderId?: string | null;
};

export type Employee = { id: string; name: string; unitPrice: number };

/** Rappel de paiement convenu de vive voix, envoyé à la main via le WhatsApp du propriétaire. */
export type Reminder = {
  id: string;
  name: string;
  phone: string;
  amount: number;
  note: string;
  dueDate: string | null;
  paymentLink: string | null;
  /** Vrai dès que le client a payé via le lien : l'entrée est alors créditée en caisse. */
  paid?: boolean;
  createdAt: string;
};

/** Numéro WhatsApp au format international, chiffres uniquement (33… pour la France). */
export function whatsappDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = `33${d.slice(1)}`;
  return d;
}

/** Date "YYYY-MM-DD" affichée en français (ex. : 20/10/2026). */
export function formatDueDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Message du rappel : {nom}, {montant}, {date} et {lien} sont remplacés par les valeurs du rappel. */
export function reminderMessage(template: string, r: { name: string; amount: number; dueDate?: string | null }, link: string): string {
  return template
    .replaceAll("{nom}", r.name)
    .replaceAll("{montant}", r.amount.toFixed(2).replace(".", ","))
    .replaceAll("{date}", formatDueDate(r.dueDate))
    .replaceAll("{lien}", link);
}

/** Salaire payé à l'unité : nombre d'unités × prix par unité, arrondi au centime. */
export function salaryAmount(units: number, unitPrice: number): number {
  return Math.round(units * unitPrice * 100) / 100;
}

export type CashBook = {
  /** Entrées automatiques (paiements reçus) + entrées manuelles, triées par date. */
  entries: CashEntry[];
  expenses: CashEntry[];
  purchases: CashEntry[];
  employees: CashEntry[];
  staff?: Employee[];
  /** Remboursements des achats à crédit. */
  repayments?: CashEntry[];
  /** Dernier comptage manuel de l'argent en caisse (montant + moment où il a été saisi). */
  drawer?: { amount: number; setAt: string } | null;
};

/** Argent en caisse = dernier montant saisi à la main + ventes en espèces conclues depuis − achats payés comptant, remboursements et salaires/commissions saisis à la main depuis (peut devenir négatif). */
export function cashInDrawer(drawer: { amount: number; setAt: string } | null | undefined, entries: CashEntry[], outflows: CashEntry[] = []): number {
  const since = drawer ? new Date(drawer.setAt).getTime() : -Infinity;
  const after = (e: CashEntry) => new Date(e.createdAt ?? e.date).getTime() > since;
  const sales = entries.filter((e) => e.kind === "especes" && after(e)).reduce((s, e) => s + e.amount, 0);
  const out = outflows.filter((e) => (e.kind === "remboursement" || (e.kind === "achat" && !e.onCredit) || (e.kind === "salaire" && !e.orderId)) && after(e)).reduce((s, e) => s + e.amount, 0);
  return Math.round(((drawer?.amount ?? 0) + sales - out) * 100) / 100;
}

export type Debt = { id: string; label: string; date: string; amount: number; paid: number; remaining: number };

/** Achats à crédit encore dus : montant − remboursements, du plus ancien au plus récent. */
export function purchaseDebts(purchases: CashEntry[], repayments: CashEntry[]): Debt[] {
  return purchases
    .filter((p) => p.onCredit)
    .map((p) => {
      const paid = Math.round(repayments.filter((r) => r.purchaseId === p.id).reduce((s, r) => s + r.amount, 0) * 100) / 100;
      return { id: p.id, label: p.label, date: p.date, amount: p.amount, paid, remaining: Math.round((p.amount - paid) * 100) / 100 };
    })
    .filter((d) => d.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Commission Stripe prélevée sur chaque entrée (vente du site ou entrée manuelle). */
export const STRIPE_FEE_RATE = 0.0035;

/** Commission Stripe sur un montant, arrondie au centime. */
export function stripeFee(amount: number): number {
  return Math.round(amount * STRIPE_FEE_RATE * 100) / 100;
}

export type CashSummary = {
  inTotal: number;
  /** Entrées carte (ventes du site + entrées manuelles), commission Stripe déjà déduite. */
  cardIn: number;
  /** Ventes payées en espèces, commission du vendeur déjà déduite. */
  cashIn: number;
  outTotal: number;
  purchaseTotal: number;
  employeeTotal: number;
  feeTotal: number;
  net: number;
};

/** Vente en espèces : le montant crédité est le total moins la commission du vendeur. */
export function cashSaleAmount(total: number, commission: number): number {
  return Math.max(0, Math.round((total - commission) * 100) / 100);
}

/** Gains nets = entrées (auto + manuelles) − commission Stripe − sorties − achats de téléphones. Les salaires n'entrent pas dans le calcul : ils servent seulement au suivi, employé par employé. */
export function summarizeCash(book: CashBook): CashSummary {
  const card = book.entries.filter((e) => e.kind !== "especes");
  const inTotal = book.entries.reduce((s, e) => s + e.amount, 0);
  const cashIn = book.entries.filter((e) => e.kind === "especes").reduce((s, e) => s + e.amount, 0);
  const outTotal = book.expenses.reduce((s, e) => s + e.amount, 0);
  const purchaseTotal = book.purchases.reduce((s, e) => s + e.amount, 0);
  const employeeTotal = book.employees.reduce((s, e) => s + e.amount, 0);
  const feeTotal = card.reduce((s, e) => s + stripeFee(e.amount), 0);
  const cardIn = Math.round((card.reduce((s, e) => s + e.amount, 0) - feeTotal) * 100) / 100;
  return { inTotal, cardIn, cashIn, outTotal, purchaseTotal, employeeTotal, feeTotal, net: inTotal - feeTotal - outTotal - purchaseTotal };
}

/** Total payé à chaque employé (le libellé d'un salaire est le nom de l'employé), du plus payé au moins payé. */
export function employeeTotals(rows: CashEntry[]): { name: string; total: number }[] {
  const byName = new Map<string, number>();
  for (const r of rows) byName.set(r.label, (byName.get(r.label) ?? 0) + r.amount);
  return [...byName.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

/** "YYYY-MM" du mois (heure de Paris) d'une date ISO ou "YYYY-MM-DD". */
export function monthOf(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).formatToParts(new Date(date));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

/** La caisse repart de zéro le 1er de chaque mois : on ne garde que les lignes du mois choisi. */
export function filterBookByMonth(book: CashBook, month: string): CashBook {
  const keep = (rows: CashEntry[]) => rows.filter((r) => monthOf(r.date) === month);
  return { entries: keep(book.entries), expenses: keep(book.expenses), purchases: keep(book.purchases), employees: keep(book.employees) };
}

/** Complète un livre de caisse partiel (ancienne forme en cache) avec des listes vides. */
export function normalizeBook(book: Partial<CashBook> | null | undefined): CashBook {
  return {
    entries: book?.entries ?? [],
    expenses: book?.expenses ?? [],
    purchases: book?.purchases ?? [],
    employees: book?.employees ?? [],
    staff: book?.staff ?? [],
    drawer: book?.drawer ?? null,
    repayments: book?.repayments ?? [],
  };
}

/** Mois disponibles (mois courant inclus), du plus récent au plus ancien. */
export function availableMonths(book: CashBook, current: string): string[] {
  const set = new Set<string>([current]);
  for (const r of [...book.entries, ...book.expenses, ...book.purchases, ...book.employees]) set.add(monthOf(r.date));
  return [...set].sort().reverse();
}
