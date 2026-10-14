import iphoneSeImg from "@/assets/iphone-se-2020.png";
import cloneImg from "@/assets/clone-deliveroo.png";

export type Product = { id: string; name: string; description: string; price: number; tag: string; image: string; imageW: number; imageH: number };

export const products: Product[] = [
  { id: "iphone-se-2020", name: "iPhone SE 2020", description: "Écran 4,7\", puce A13 Bionic, Touch ID.", price: 300, tag: "Apple", image: iphoneSeImg, imageW: 701, imageH: 1005 },
  { id: "clone-deliveroo", name: "Clone Deliveroo", description: "Deux téléphones Android livrés ensemble, prêts à l'emploi.", price: 380, tag: "Android ×2", image: cloneImg, imageW: 1151, imageH: 951 },
];

// Abonnement à l'application : 20 € par semaine.
export const APP_PLAN_PRICE = 20;
export const APP_PLAN_LABEL = "Abonnement à l'application : 20 € par semaine";

export const DELIVERY_FEE = 5;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const brl = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function orderTotal(subtotal: number) {
  return subtotal + (subtotal > 0 ? DELIVERY_FEE : 0);
}
