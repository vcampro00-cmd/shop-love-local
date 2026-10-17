import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCatalog, type CatalogProduct } from "./catalog.functions";
import { getProduct } from "./products";

export const catalogQueryOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
});

export type ShopProduct = CatalogProduct & { image: string; imageW: number; imageH: number };

function withImage(p: CatalogProduct): ShopProduct {
  const builtin = getProduct(p.id);
  if (p.imageUrl) return { ...p, image: p.imageUrl, imageW: 600, imageH: 600 };
  return { ...p, image: builtin?.image ?? "", imageW: builtin?.imageW ?? 600, imageH: builtin?.imageH ?? 600 };
}

/** Catalogue des téléphones : `list` = en vente, `get` = n'importe lequel (y compris retirés). */
export function useCatalog() {
  const { data } = useSuspenseQuery(catalogQueryOptions);
  const all = (data ?? []).map(withImage);
  const map = new Map(all.map((p) => [p.id, p]));
  return {
    list: all.filter((p) => p.active),
    get: (id: string) => map.get(id),
    priceOf: (id: string) => map.get(id)?.price ?? 0,
    fullOnlyIds: all.filter((p) => p.fullPaymentOnly).map((p) => p.id),
  };
}

/** Réduit une photo choisie par le propriétaire (max 700 px) en data URL webp. */
export async function shrinkImage(file: File, max = 700): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
