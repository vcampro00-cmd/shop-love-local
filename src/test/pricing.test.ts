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
    expect(totals).toEqual({ subtotal: 680, deliveryFee: 20, total: 700 });
  });

  it("compte la quantité", () => {
    const totals = computeTotals([{ id: "iphone-se-2020", qty: 3 }], priceOf, 20);
    expect(totals).toEqual({ subtotal: 900, deliveryFee: 20, total: 920 });
  });

  it("ne facture pas la livraison d'un panier vide", () => {
    expect(computeTotals([], priceOf, 20)).toEqual({ subtotal: 0, deliveryFee: 0, total: 0 });
  });

  it("compte l'iPhone 7 GPS Manager à 150 € la pièce", () => {
    const totals = computeTotals([{ id: "iphone-7-gps-manager", qty: 2 }], priceOf, 20);
    expect(totals).toEqual({ subtotal: 300, deliveryFee: 20, total: 320 });
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

import { splitPayment } from "@/lib/pricing";
describe("paiement en 2 fois", () => {
  it("iPhone 300 € : 150 € maintenant et 150 € dans une semaine", () => {
    expect(splitPayment(300, "split")).toEqual({ now: 150, later: 150 });
  });
  it("en une fois : tout maintenant, rien ensuite", () => {
    expect(splitPayment(300, "full")).toEqual({ now: 300, later: 0 });
  });
  it("le centime impair va sur le 1er paiement", () => {
    expect(splitPayment(100.01, "split")).toEqual({ now: 50.01, later: 50 });
  });
});
