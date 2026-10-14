// Règles de calcul du panier, sans dépendance au navigateur.
// Le serveur recalcule les totaux avec ces fonctions : les montants envoyés par le
// navigateur ne sont jamais enregistrés tels quels.

export const PRODUCT_IDS = ["iphone-se-2020", "clone-deliveroo", "iphone-7-gps-manager"] as const;

export type CartItem = { id: string; qty: number };

export function isKnownProduct(id: string): boolean {
  return (PRODUCT_IDS as readonly string[]).includes(id);
}

export type Totals = { subtotal: number; deliveryFee: number; total: number };

export type DeliveryMethod = "livraison" | "retrait";

/** Frais de livraison seulement quand le panier n'est pas vide et que le client choisit la livraison. */
export function computeTotals(
  items: CartItem[],
  priceOf: (id: string) => number,
  deliveryFee: number,
  method: DeliveryMethod = "livraison",
): Totals {
  const subtotal = items.reduce((sum, item) => sum + priceOf(item.id) * item.qty, 0);
  const shipping = subtotal > 0 && method === "livraison" ? deliveryFee : 0;
  return { subtotal, deliveryFee: shipping, total: subtotal + shipping };
}

export type PaymentPlan = "full" | "split";

/**
 * Montant payé tout de suite et montant prélevé une semaine plus tard.
 * En 2 fois : deux moitiés (au centime près, le centime en trop va sur le 1er paiement).
 */
export function splitPayment(total: number, plan: PaymentPlan): { now: number; later: number } {
  if (plan === "full") return { now: total, later: 0 };
  const cents = Math.round(total * 100);
  const nowCents = Math.ceil(cents / 2);
  return { now: nowCents / 100, later: (cents - nowCents) / 100 };
}

/** Le 2e prélèvement a lieu 7 jours après le 1er paiement. */
export const SECOND_CHARGE_DELAY_DAYS = 7;

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
