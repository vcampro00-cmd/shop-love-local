import iphoneSeImg from "@/assets/iphone-se-2020.png";
import cloneImg from "@/assets/clone-deliveroo.png";

// Les textes et les prix des fiches téléphones sont éditables par le propriétaire
// (voir src/lib/content.defaults.ts). Ce fichier ne garde que l'identifiant et la photo.
export type Product = { id: string; image: string; imageW: number; imageH: number };

export const products: Product[] = [
  { id: "iphone-se-2020", image: iphoneSeImg, imageW: 701, imageH: 1005 },
  { id: "clone-deliveroo", image: cloneImg, imageW: 1151, imageH: 951 },
];

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const brl = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
