import { describe, expect, it } from "vitest";
import { splitReminder } from "@/lib/pricing";

describe("splitReminder", () => {
  it("3 fois : 3 échéances à une semaine d'écart", () => {
    expect(splitReminder(300, 3, "2026-10-27")).toEqual([
      { amount: 100, dueDate: "2026-10-27" },
      { amount: 100, dueDate: "2026-11-03" },
      { amount: 100, dueDate: "2026-11-10" },
    ]);
  });
  it("le centime en trop va sur la 1re échéance et la somme reste exacte", () => {
    const parts = splitReminder(100, 3, "2026-10-27");
    expect(parts.map((p) => p.amount)).toEqual([33.34, 33.33, 33.33]);
  });
  it("jamais plus de 3 fois", () => {
    expect(splitReminder(90, 5, "2026-10-27")).toHaveLength(3);
  });
});
