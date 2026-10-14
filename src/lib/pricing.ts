// Règles de calcul du panier, sans dépendance au navigateur.
// Le serveur recalcule les totaux avec ces fonctions : les montants envoyés par le
// navigateur ne sont jamais enregistrés tels quels.

export const PRODUCT_IDS = ["iphone-se-2020", "clone-deliveroo"] as const;

export type CartItem = { id: string; qty: number };

export function isKnownProduct(id: string): boolean {
  return (PRODUCT_IDS as readonly string[]).includes(id);
}

export type Totals = { subtotal: number; deliveryFee: number; total: number };

/** Frais de livraison seulement quand le panier n'est pas vide. */
export function computeTotals(
  items: CartItem[],
  priceOf: (id: string) => number,
  deliveryFee: number,
): Totals {
  const subtotal = items.reduce((sum, item) => sum + priceOf(item.id) * item.qty, 0);
  const shipping = subtotal > 0 ? deliveryFee : 0;
  return { subtotal, deliveryFee: shipping, total: subtotal + shipping };
}

// Alphabet sans I, O, 0, 1 : lisible quand on l'écrit à la main.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "00ff2200ff22" → "VCA9CA9C". La partie aléatoire vient du serveur. */
export function makeOrderRef(randomHex: string): string {
  let out = "";
  for (let i = 0; i + 1 < randomHex.length && out.length < 6; i += 2) {
    out += ALPHABET[parseInt(randomHex.slice(i, i + 2), 16) % ALPHABET.length];
  }
  return `VC${out}`;
}
