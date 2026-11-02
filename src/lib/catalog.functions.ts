import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CatalogProduct = {
  id: string;
  name: string;
  tag: string;
  description: string;
  descriptionPt: string;
  price: number;
  commission: number;
  fullPaymentOnly: boolean;
  imageUrl: string | null;
  active: boolean;
};

/** Catalogue public (téléphones en vente et anciens, pour afficher les vieilles commandes). */
export const getCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<CatalogProduct[]> => {
  const { readCatalog } = await import("./catalog.server");
  try {
    const rows = await readCatalog();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tag: r.tag,
      description: r.description,
      descriptionPt: (r as { description_pt?: string | null }).description_pt ?? "",
      price: Number(r.price),
      commission: Number(r.commission),
      fullPaymentOnly: r.full_payment_only,
      imageUrl: r.image_url,
      active: r.active,
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
});

async function assertAdmin(client: any, userId: string) {
  const { data } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé au propriétaire.");
}

const productInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(2).max(80),
  tag: z.string().trim().max(40).default(""),
  description: z.string().trim().max(1000).default(""),
  descriptionPt: z.string().trim().max(1000).default(""),
  price: z.number().min(0).max(100000),
  commission: z.number().min(0).max(100000),
  fullPaymentOnly: z.boolean(),
  // Photo réduite dans le navigateur (data URL webp/jpeg/png), ou null pour garder l'actuelle.
  image: z.string().max(1_500_000).regex(/^data:image\/(webp|jpeg|png);base64,/).nullable().optional(),
});

function slug(name: string) {
  const base = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "telephone";
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return `${base}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Ajoute ou modifie un téléphone — propriétaire seulement. */
export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => productInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      name: data.name,
      tag: data.tag,
      description: data.description,
      description_pt: data.descriptionPt,
      price: data.price,
      commission: data.commission,
      full_payment_only: data.fullPaymentOnly,
      ...(data.image ? { image_url: data.image } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase.from("catalog_products").update(row).eq("id", data.id);
      if (error) throw new Error("Le téléphone n'a pas pu être enregistré.");
      return { id: data.id };
    }
    const id = slug(data.name);
    const { error } = await context.supabase
      .from("catalog_products")
      .insert({ ...row, id, active: true, sort: Math.floor(Date.now() / 1000) });
    if (error) throw new Error("Le téléphone n'a pas pu être ajouté.");
    return { id };
  });

/** Retire un téléphone de la vente (il reste lisible dans les anciennes commandes). */
export const removeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("catalog_products").update({ active: false }).eq("id", data.id);
    if (error) throw new Error("Le téléphone n'a pas pu être retiré.");
    return { ok: true };
  });
