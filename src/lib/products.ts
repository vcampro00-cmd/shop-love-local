import iphoneSeImg from "@/assets/iphone-se-2020.png";
import clone1Img from "@/assets/clone-deliveroo-1.png";
import clone2Img from "@/assets/clone-deliveroo-2.png";

export type Product = { id: string; name: string; description: string; price: number; tag: string; image: string };

export const products: Product[] = [
  { id: "iphone-se-2020", name: "iPhone SE 2020", description: "Écran 4,7\", puce A13 Bionic, Touch ID.", price: 300, tag: "Apple", image: iphoneSeImg },
  { id: "clone-deliveroo-1", name: "Clone Deliveroo 1", description: "Android 13, écran 6,5\", batterie 5000 mAh.", price: 300, tag: "Android", image: clone1Img },
  { id: "clone-deliveroo-2", name: "Clone Deliveroo 2", description: "Android 13, écran 6,6\", batterie 5000 mAh.", price: 300, tag: "Android", image: clone2Img },
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
