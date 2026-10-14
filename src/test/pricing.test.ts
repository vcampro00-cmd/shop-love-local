import { describe, expect, it } from "vitest";
import { computeTotals, isKnownProduct, makeOrderRef } from "@/lib/pricing";

// Les montants viennent des valeurs du propriétaire : iPhone SE 2020 300 €,
// Duo Android 380 €, frais de livraison 20 €.
const priceOf = (id: string) =>
  ({ "iphone-se-2020": 300, "clone-deliveroo": 380 })[id as "iphone-se-2020" | "clone-deliveroo"] ?? 0;

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
});

describe("Référence de commande", () => {
  it("commence par VC et fait 8 caractères lisibles", () => {
    const ref = makeOrderRef("00ff2200ff22");
    expect(ref).toBe("VCA9CA9C");
    expect(ref).toMatch(/^VC[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/);
  });

  it("refuse un identifiant de téléphone inconnu", () => {
    expect(isKnownProduct("clone-deliveroo")).toBe(true);
    expect(isKnownProduct("redmi-note-11s")).toBe(false);
  });
});
