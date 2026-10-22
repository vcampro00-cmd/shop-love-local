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

/** Frais de livraison seulement quand le panier n'est pas vide et que le client choisit la livraison.
 *  Le code promo retire un montant fixe du total (jamais en dessous de 0). */
export function computeTotals(
  items: CartItem[],
  priceOf: (id: string) => number,
  deliveryFee: number,
  method: DeliveryMethod = "livraison",
  discount = 0,
): Totals & { discount: number } {
  const subtotal = items.reduce((sum, item) => sum + priceOf(item.id) * item.qty, 0);
  const shipping = subtotal > 0 && method === "livraison" ? deliveryFee : 0;
  const gross = subtotal + shipping;
  const applied = Math.min(Math.max(discount, 0), gross);
  return { subtotal, deliveryFee: shipping, total: gross - applied, discount: applied };
}

/** Commission du vendeur par téléphone vendu. */
export const COMMISSION_PER_UNIT: Record<string, number> = {
  "iphone-se-2020": 50,
  "iphone-7-gps-manager": 50,
  "clone-deliveroo": 60,
};

export function commissionFor(
  items: CartItem[],
  commissionOf: (id: string) => number = (id) => COMMISSION_PER_UNIT[id] ?? 0,
): number {
  return items.reduce((s, i) => s + commissionOf(i.id) * i.qty, 0);
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type PaymentPlan = "full" | "split";

/** Téléphones qui se paient uniquement en une fois (jamais en 2 fois). */
export const FULL_PAYMENT_ONLY_IDS = ["iphone-7-gps-manager"] as const;

/** Le paiement en 2 fois n'est proposé que si aucun article « une seule fois » n'est dans le panier. */
export function canPayInTwoTimes(
  items: CartItem[],
  fullOnlyIds: readonly string[] = FULL_PAYMENT_ONLY_IDS,
): boolean {
  return !items.some((item) => fullOnlyIds.includes(item.id));
}

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

/** "2026-11-05" → ISO du 2e prélèvement, fixé à 12 h UTC ce jour-là (le cron tourne toutes les heures). */
export function secondChargeDueFrom(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "00ff2200ff22" → "VCA9CA9C". La partie aléatoire vient du serveur. */
export function makeOrderRef(randomHex: string): string {
  let out = "";
  for (let i = 0; i + 1 < randomHex.length && out.length < 6; i += 2) {
    out += ALPHABET[parseInt(randomHex.slice(i, i + 2), 16) % ALPHABET.length];
  }
  return `VC${out}`;
}
