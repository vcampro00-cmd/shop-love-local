import { describe, expect, it } from "vitest";
import { summarizeCash, type CashEntry } from "@/lib/cash";

const entry = (id: string, amount: number, kind: CashEntry["kind"] = "auto"): CashEntry => ({
  id,
  date: "2026-10-14",
  label: id,
  amount,
  kind,
});

describe("summarizeCash", () => {
  it("calculates net as income minus expenses minus phone purchases", () => {
    const book = {
      entries: [entry("auto-1", 320), entry("manual-1", 100, "entree")],
      expenses: [entry("out-1", 30, "sortie")],
      purchases: [entry("buy-1", 150, "achat")],
      employees: [],
    };
    const s = summarizeCash(book);
    expect(s.inTotal).toBe(420);
    expect(s.outTotal).toBe(30);
    expect(s.purchaseTotal).toBe(150);
    expect(s.net).toBe(240);
  });

  it("an empty book nets to zero", () => {
    const s = summarizeCash({ entries: [], expenses: [], purchases: [], employees: [] });
    expect(s.net).toBe(0);
  });

  it("a purchase alone makes the net negative", () => {
    const s = summarizeCash({
      entries: [],
      expenses: [],
      purchases: [entry("buy-1", 150, "achat"), entry("buy-2", 300, "achat")],
      employees: [],
    });
    expect(s.net).toBe(-450);
  });

  it("keeps salaries out of the net but still totals them", () => {
    const s = summarizeCash({
      entries: [entry("auto-1", 320)],
      expenses: [],
      purchases: [],
      employees: [entry("salary-1", 80, "salaire"), entry("salary-2", 40, "salaire")],
    });
    expect(s.employeeTotal).toBe(120);
    expect(s.net).toBe(320);
  });
});

import { employeeTotals } from "@/lib/cash";
describe("employeeTotals", () => {
  it("sums payments per employee name", () => {
    const rows = [
      { id: "1", date: "2026-10-01", label: "Ana", amount: 80, kind: "salaire" as const },
      { id: "2", date: "2026-10-02", label: "Bruno", amount: 40, kind: "salaire" as const },
      { id: "3", date: "2026-10-03", label: "Ana", amount: 20, kind: "salaire" as const },
    ];
    expect(employeeTotals(rows)).toEqual([
      { name: "Ana", total: 100 },
      { name: "Bruno", total: 40 },
    ]);
  });
});

import { filterBookByMonth, monthOf } from "@/lib/cash";
describe("caisse mensuelle", () => {
  const book = {
    entries: [
      { id: "a", date: "2026-10-01T08:00:00Z", label: "x", amount: 100, kind: "auto" as const },
      { id: "b", date: "2026-09-30T21:30:00Z", label: "y", amount: 50, kind: "auto" as const },
    ],
    expenses: [{ id: "c", date: "2026-09-15", label: "z", amount: 20, kind: "sortie" as const }],
    purchases: [],
    employees: [{ id: "d", date: "2026-10-05", label: "salaire", amount: 60, kind: "salaire" as const }],
  };
  it("repart de zéro le 1er du mois", () => {
    expect(summarizeCash(filterBookByMonth(book, "2026-10")).net).toBe(100);
  });
  it("garde le mois précédent consultable", () => {
    expect(summarizeCash(filterBookByMonth(book, "2026-09")).net).toBe(30);
  });
  it("utilise l'heure de Paris", () => {
    expect(monthOf("2026-09-30T22:30:00Z")).toBe("2026-10");
  });
});

import { salaryAmount } from "@/lib/cash";
describe("salaire à l'unité", () => {
  it("multiplie les unités par le prix par unité", () => {
    expect(salaryAmount(4, 12.5)).toBe(50);
  });
});
