import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type CatalogRow = Database["public"]["Tables"]["catalog_products"]["Row"];

/** Catalogue lu côté serveur avec la clé publique (lecture seule). */
export async function readCatalog(): Promise<CatalogRow[]> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb.from("catalog_products").select("*").order("sort").order("created_at");
  if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);
  return data ?? [];
}
