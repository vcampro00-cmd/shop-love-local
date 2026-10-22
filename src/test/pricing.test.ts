import { describe, expect, it } from "vitest";
import { computeTotals, isKnownProduct, makeOrderRef } from "@/lib/pricing";

// Les montants viennent des valeurs du propriétaire : iPhone SE 2020 300 €,
// Duo Android 380 €, frais de livraison 20 €.
const priceOf = (id: string) =>
  ({ "iphone-se-2020": 300, "clone-deliveroo": 380, "iphone-7-gps-manager": 150 })[
    id as "iphone-se-2020" | "clone-deliveroo" | "iphone-7-gps-manager"
  ] ?? 0;

describe("Totaux de commande", () => {
  it("additionne les téléphones et ajoute les frais de livraison", () => {
    const totals = computeTotals([{ id: "iphone-se-2020", qty: 1 }, { id: "clone-deliveroo", qty: 1 }], priceOf, 20);
    expect(totals).toEqual({ subtotal: 680, deliveryFee: 20, total: 700, discount: 0 });
  });

  it("compte la quantité", () => {
    const totals = computeTotals([{ id: "iphone-se-2020", qty: 3 }], priceOf, 20);
    expect(totals).toEqual({ subtotal: 900, deliveryFee: 20, total: 920, discount: 0 });
  });

  it("ne facture pas la livraison d'un panier vide", () => {
    expect(computeTotals([], priceOf, 20)).toEqual({ subtotal: 0, deliveryFee: 0, total: 0, discount: 0 });
  });

  it("compte l'iPhone 7 GPS Manager à 150 € la pièce", () => {
    const totals = computeTotals([{ id: "iphone-7-gps-manager", qty: 2 }], priceOf, 20);
    expect(totals).toEqual({ subtotal: 300, deliveryFee: 20, total: 320, discount: 0 });
  });
});

describe("Référence de commande", () => {
  it("commence par VC et fait 8 caractères lisibles", () => {
    const ref = makeOrderRef("00ff2200ff22");
    expect(ref).toBe("VCA9CA9C");
    expect(ref).toMatch(/^VC[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/);
  });

  it("refuse un identifiant de téléphone inconnu", () => {
    expect(isKnownProduct("clone-deliveroo")).toBe(true);
    expect(isKnownProduct("iphone-7-gps-manager")).toBe(true);
    expect(isKnownProduct("redmi-note-11s")).toBe(false);
  });
});

import { splitPayment, canPayInTwoTimes } from "@/lib/pricing";
describe("paiement en 2 fois", () => {
  it("iPhone 300 € : 150 € maintenant et 150 € dans une semaine", () => {
    expect(splitPayment(300, "split")).toEqual({ now: 150, later: 150 });
  });
  it("l'iPhone 7 GPS Manager se paie uniquement en une fois", () => {
    expect(canPayInTwoTimes([{ id: "iphone-7-gps-manager", qty: 1 }])).toBe(false);
  });
  it("les autres téléphones acceptent le paiement en 2 fois", () => {
    expect(canPayInTwoTimes([{ id: "iphone-se-2020", qty: 1 }])).toBe(true);
    expect(canPayInTwoTimes([{ id: "clone-deliveroo", qty: 1 }])).toBe(true);
  });
  it("en une fois : tout maintenant, rien ensuite", () => {
    expect(splitPayment(300, "full")).toEqual({ now: 300, later: 0 });
  });
  it("le centime impair va sur le 1er paiement", () => {
    expect(splitPayment(100.01, "split")).toEqual({ now: 50.01, later: 50 });
  });
});

import { commissionFor, normalizePromoCode } from "@/lib/pricing";
describe("code promo et commissions", () => {
  it("VCAMPRO20 retire 20 € du total", () => {
    expect(computeTotals([{ id: "iphone-se-2020", qty: 1 }], priceOf, 20, "livraison", 20).total).toBe(300);
  });
  it("le total ne descend jamais sous 0", () => {
    expect(computeTotals([{ id: "iphone-7-gps-manager", qty: 1 }], priceOf, 20, "retrait", 500).total).toBe(0);
  });
  it("le code est lu en majuscules", () => {
    expect(normalizePromoCode(" vcampro20 ")).toBe("VCAMPRO20");
  });
  it("commission : 50 € SE 2020 et iPhone 7, 60 € Duo Android", () => {
    expect(commissionFor([{ id: "iphone-se-2020", qty: 1 }])).toBe(50);
    expect(commissionFor([{ id: "iphone-7-gps-manager", qty: 2 }])).toBe(100);
    expect(commissionFor([{ id: "clone-deliveroo", qty: 1 }])).toBe(60);
  });
});

import { secondChargeDueFrom } from "@/lib/pricing";
describe("date du 2e paiement", () => {
  it("fixe le prélèvement à 12 h le jour choisi par le propriétaire", () => {
    expect(secondChargeDueFrom("2026-11-05")).toBe("2026-11-05T12:00:00.000Z");
  });
  it("refuse une date invalide", () => {
    expect(secondChargeDueFrom("pas-une-date")).toBeNull();
    expect(secondChargeDueFrom("")).toBeNull();
  });
});
