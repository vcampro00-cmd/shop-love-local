export type CashEntryKind = "auto" | "entree" | "sortie" | "achat";

export type CashEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  kind: CashEntryKind;
};

export type CashBook = {
  /** Entrées automatiques (paiements reçus) + entrées manuelles, triées par date. */
  entries: CashEntry[];
  expenses: CashEntry[];
  purchases: CashEntry[];
};

export type CashSummary = {
  inTotal: number;
  outTotal: number;
  purchaseTotal: number;
  net: number;
};

/** Gains nets = entrées (auto + manuelles) − sorties − achats de téléphones. */
export function summarizeCash(book: CashBook): CashSummary {
  const inTotal = book.entries.reduce((s, e) => s + e.amount, 0);
  const outTotal = book.expenses.reduce((s, e) => s + e.amount, 0);
  const purchaseTotal = book.purchases.reduce((s, e) => s + e.amount, 0);
  return { inTotal, outTotal, purchaseTotal, net: inTotal - outTotal - purchaseTotal };
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
  return { entries: keep(book.entries), expenses: keep(book.expenses), purchases: keep(book.purchases) };
}

/** Mois disponibles (mois courant inclus), du plus récent au plus ancien. */
export function availableMonths(book: CashBook, current: string): string[] {
  const set = new Set<string>([current]);
  for (const r of [...book.entries, ...book.expenses, ...book.purchases]) set.add(monthOf(r.date));
  return [...set].sort().reverse();
}
