export type Product = { id: string; name: string; description: string; price: number; tag: string };

// Prix d'exemple — à remplacer par les prix réels.
export const products: Product[] = [
  { id: "iphone-se-2020", name: "iPhone SE 2020", description: "Écran 4,7\", puce A13 Bionic, Touch ID.", price: 199, tag: "Apple" },
  { id: "redmi-11s", name: "Redmi Note 11S", description: "Écran AMOLED 6,43\", appareil photo 108 Mpx.", price: 179, tag: "Xiaomi" },
];

export const DELIVERY_FEE = 5;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const brl = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function orderTotal(subtotal: number, method: "entrega" | "retirada") {
  return subtotal + (method === "entrega" && subtotal > 0 ? DELIVERY_FEE : 0);
}
