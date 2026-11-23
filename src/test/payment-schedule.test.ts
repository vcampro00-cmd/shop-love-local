import { describe, expect, it } from "vitest";
import { paymentSchedule } from "@/lib/payment-schedule";

describe("dates et montants WhatsApp enregistrés", () => {
  it("inclut chaque montant avec sa date personnalisée, dans l'ordre", () => {
    expect(paymentSchedule([
      { amount: 75, dueDate: "2026-12-19" },
      { amount: 150, dueDate: "2026-11-30" },
      { amount: 75, dueDate: "2026-12-03" },
    ])).toBe("150,00 € — 30/11/2026 ; 75,00 € — 03/12/2026 ; 75,00 € — 19/12/2026");
  });

  it("ne fabrique aucune date pour un paiement sans échéance", () => {
    expect(paymentSchedule([{ amount: 20, dueDate: null }])).toBe("20,00 €");
    expect(paymentSchedule([])).toBe("");
  });
});