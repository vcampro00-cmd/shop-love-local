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
    };
    const s = summarizeCash(book);
    expect(s.inTotal).toBe(420);
    expect(s.outTotal).toBe(30);
    expect(s.purchaseTotal).toBe(150);
    expect(s.net).toBe(240);
  });

  it("an empty book nets to zero", () => {
    const s = summarizeCash({ entries: [], expenses: [], purchases: [] });
    expect(s.net).toBe(0);
  });

  it("a purchase alone makes the net negative", () => {
    const s = summarizeCash({
      entries: [],
      expenses: [],
      purchases: [entry("buy-1", 150, "achat"), entry("buy-2", 300, "achat")],
    });
    expect(s.net).toBe(-450);
  });
});
