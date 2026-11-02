import iphoneSeImg from "@/assets/iphone-se-2020.png";
import cloneImg from "@/assets/clone-deliveroo.png";
import iphone7Img from "@/assets/iphone-7-gps-manager.png";
import iphoneXrImg from "@/assets/iphone-xr.png";

// Les textes et les prix des fiches téléphones sont éditables par le propriétaire
// (voir src/lib/content.defaults.ts). Ce fichier ne garde que l'identifiant et la photo.
export type Product = { id: string; image: string; imageW: number; imageH: number };

export const products: Product[] = [
  { id: "iphone-se-2020", image: iphoneSeImg, imageW: 750, imageH: 1161 },
  { id: "clone-deliveroo", image: cloneImg, imageW: 1056, imageH: 846 },
  { id: "iphone-7-gps-manager", image: iphone7Img, imageW: 717, imageH: 1331 },
  { id: "iphone-xr", image: iphoneXrImg, imageW: 954, imageH: 924 },
];

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const brl = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
