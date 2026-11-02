import { describe, expect, it } from "vitest";
import { DEFAULTS } from "@/lib/content.defaults";
import { DEFAULTS_PT } from "@/lib/content.defaults.pt";
import { isMoneyKey, ptKey, resolveText } from "@/lib/content";

// Règle : chaque texte français non vide a une traduction portugaise par défaut,
// sauf les prix et frais (communs aux deux langues).
describe("traductions portugaises", () => {
  it("couvre tous les textes par défaut non vides", () => {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (!value.trim()) continue;
      expect(DEFAULTS_PT[key]?.trim() ?? "", `traduction PT manquante : ${key}`).not.toBe("");
    }
  });

  it("ne connait que des clés existantes côté français", () => {
    for (const key of Object.keys(DEFAULTS_PT)) {
      expect(DEFAULTS[key] !== undefined, `clé PT inconnue côté FR : ${key}`).toBe(true);
    }
  });
});

describe("resolveText", () => {
  it("renvoie le français par défaut quand la langue est fr", () => {
    expect(resolveText("nav.shop", "fr", {})).toBe("Boutique");
  });

  it("renvoie la traduction portugaise par défaut quand la langue est pt", () => {
    expect(resolveText("nav.shop", "pt", {})).toBe("Loja");
  });

  it("fait passer la saisie du propriétaire en portugais (clé __pt) devant la traduction", () => {
    expect(resolveText("nav.shop", "pt", { [ptKey("nav.shop")]: "Minha loja" })).toBe("Minha loja");
  });

  it("garde le texte français du propriétaire quand la clé n'a pas de texte par défaut", () => {
    // « product.iphone-7-gps-manager.description » n'a pas de valeur par défaut.
    expect(resolveText("product.iphone-7-gps-manager.description", "pt", { "product.iphone-7-gps-manager.description": "Bon téléphone" })).toBe("Bon téléphone");
  });

  it("la traduction portugaise par défaut passe devant le texte français du propriétaire", () => {
    // Le portugais reste traduit même si le français a été personnalisé :
    // pour changer le portugais, le propriétaire écrit l'onglet Português dans /editar.
    expect(resolveText("home.heroTitleA", "pt", { "home.heroTitleA": "Achetez ici" })).toBe("Compre online na");
  });

  it("garde le prix et les frais identiques dans les deux langues", () => {
    expect(isMoneyKey("delivery.fee")).toBe(true);
    expect(isMoneyKey("product.iphone-se-2020.price")).toBe(true);
    expect(isMoneyKey("nav.shop")).toBe(false);
    expect(resolveText("delivery.fee", "pt", { "delivery.fee": "20" })).toBe("20");
    expect(resolveText("product.clone-deliveroo.price", "pt", {})).toBe("380");
  });

  it("retombe sur une chaîne vide pour une clé inconnue", () => {
    expect(resolveText("cle.inconnue", "fr", {})).toBe("");
  });
});
