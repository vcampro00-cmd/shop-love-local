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
    expect(s.feeTotal).toBeCloseTo(1.47);
    expect(s.net).toBeCloseTo(238.53);
  });

  it("deducts the 0.35% Stripe fee from every entry, manual ones included", () => {
    const s = summarizeCash({
      entries: [entry("auto-1", 300), entry("manual-1", 200, "entree")],
      expenses: [],
      purchases: [],
      employees: [],
    });
    expect(s.feeTotal).toBe(1.75);
    expect(s.net).toBe(498.25);
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
    expect(s.net).toBe(318.88);
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
    expect(summarizeCash(filterBookByMonth(book, "2026-10")).net).toBe(99.65);
  });
  it("garde le mois précédent consultable", () => {
    expect(summarizeCash(filterBookByMonth(book, "2026-09")).net).toBe(29.82);
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

import { reminderMessage, whatsappDigits } from "@/lib/cash";

describe("rappels WhatsApp", () => {
  it("normalise un numéro français 06… en 336…", () => {
    expect(whatsappDigits("06 12 34 56 78")).toBe("33612345678");
  });
  it("garde un numéro déjà international et retire le 00", () => {
    expect(whatsappDigits("00336 12 34 56 78")).toBe("33612345678");
    expect(whatsappDigits("+33 6 12 34 56 78")).toBe("33612345678");
  });
  it("remplace {nom}, {montant} et {lien} dans le message", () => {
    const msg = reminderMessage("Bonjour {nom}, rappel de {montant} € : {lien}", { name: "Léa", amount: 150 }, "https://pay.example/x");
    expect(msg).toBe("Bonjour Léa, rappel de 150,00 € : https://pay.example/x");
  });
  it("remplace {date} par la date au format français, vide si absente", () => {
    const msg = reminderMessage("{montant} € prévu le {date}", { name: "Léa", amount: 150, dueDate: "2026-10-20" }, "x");
    expect(msg).toBe("150,00 € prévu le 20/10/2026");
    expect(reminderMessage("le {date}", { name: "Léa", amount: 150, dueDate: null }, "x")).toBe("le ");
  });
});

describe("cash (espèces) sales", () => {
  it("credits the sale total minus the seller commission", async () => {
    const { cashSaleAmount } = await import("@/lib/cash");
    expect(cashSaleAmount(300, 50)).toBe(250);
  });

  it("splits card and cash entries; cash sales no longer count in the entries or the net", () => {
    const s = summarizeCash({
      entries: [entry("card", 200), entry("cash", 250, "especes")],
      expenses: [],
      purchases: [],
      employees: [],
    });
    expect(s.cardIn).toBe(199.3);
    expect(s.inTotal).toBe(200);
    expect(s.cashIn).toBe(250);
    expect(s.net).toBe(199.3);
  });
});

describe("argent en caisse", () => {
  it("adds cash sales concluded after the manual count", async () => {
    const { cashInDrawer } = await import("@/lib/cash");
    const entries = [
      { id: "old", date: "2026-10-01T10:00:00Z", label: "x", amount: 250, kind: "especes" as const },
      { id: "new", date: "2026-10-10T10:00:00Z", label: "y", amount: 100, kind: "especes" as const },
      { id: "card", date: "2026-10-10T10:00:00Z", label: "z", amount: 300, kind: "auto" as const },
    ];
    expect(cashInDrawer({ amount: 500, setAt: "2026-10-05T00:00:00Z" }, entries)).toBe(600);
  });
});

describe("achats à crédit", () => {
  const buy = (id: string, amount: number, onCredit: boolean) => ({ id, date: "2026-10-10", createdAt: "2026-10-10T10:00:00Z", label: id, amount, kind: "achat" as const, onCredit });
  it("à vue sort de la caisse, à crédit non", async () => {
    const { cashInDrawer } = await import("@/lib/cash");
    expect(cashInDrawer({ amount: 1000, setAt: "2026-10-01T00:00:00Z" }, [], [buy("a", 300, false), buy("b", 400, true)])).toBe(700);
  });
  it("les remboursements réduisent la dette et la caisse", async () => {
    const { cashInDrawer, purchaseDebts } = await import("@/lib/cash");
    const rep = { id: "r", date: "2026-10-12", createdAt: "2026-10-12T10:00:00Z", label: "r", amount: 150, kind: "remboursement" as const, purchaseId: "b" };
    expect(purchaseDebts([buy("b", 400, true)], [rep])[0]?.remaining).toBe(250);
    expect(cashInDrawer({ amount: 1000, setAt: "2026-10-01T00:00:00Z" }, [], [buy("b", 400, true), rep])).toBe(850);
  });
  it("une dette payée en entier disparaît", async () => {
    const { purchaseDebts } = await import("@/lib/cash");
    const rep = { id: "r", date: "2026-10-12", label: "r", amount: 400, kind: "remboursement" as const, purchaseId: "b" };
    expect(purchaseDebts([buy("b", 400, true)], [rep])).toEqual([]);
  });
});

describe("commissions manuelles", () => {
  it("toutes les commissions sortent de la caisse, sauf celles déjà retenues sur une vente en espèces", async () => {
    const { cashInDrawer } = await import("@/lib/cash");
    const sal = (id: string, amount: number, orderId: string | null) => ({ id, date: "2026-10-10", createdAt: "2026-10-10T10:00:00Z", label: "Ana", amount, kind: "salaire" as const, orderId });
    const cashSale = { id: "o2", date: "2026-10-10", createdAt: "2026-10-10T10:00:00Z", label: "V", amount: 250, kind: "especes" as const };
    expect(cashInDrawer({ amount: 30, setAt: "2026-10-01T00:00:00Z" }, [cashSale], [sal("m", 80, null), sal("a", 50, "o1"), sal("c", 50, "o2")])).toBe(150);
  });
});

describe("gains nets et achats à crédit", () => {
  it("un achat à crédit ne baisse pas le net ; seul le montant remboursé compte", () => {
    const s = summarizeCash({
      entries: [],
      expenses: [],
      purchases: [{ ...entry("b", 400, "achat"), onCredit: true }, entry("c", 100, "achat")],
      employees: [],
      repayments: [{ ...entry("r", 150, "remboursement"), purchaseId: "b" }],
    });
    expect(s.net).toBe(-250);
  });
});

describe("dépenses et caisse", () => {
  it("une dépense sort de l'argent en caisse", async () => {
    const { cashInDrawer } = await import("@/lib/cash");
    const dep = { id: "d", date: "2026-10-12", createdAt: "2026-10-12T10:00:00Z", label: "d", amount: 40, kind: "sortie" as const };
    expect(cashInDrawer({ amount: 100, setAt: "2026-10-01T00:00:00Z" }, [], [dep])).toBe(60);
  });
});
