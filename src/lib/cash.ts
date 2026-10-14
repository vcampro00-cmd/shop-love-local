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
