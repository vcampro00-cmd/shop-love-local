import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Texte du site lu côté serveur (prix inclus) pour les calculs qui ne doivent
 * rien faire confiance au navigateur. Chargé avec `await import()` dans les
 * gestionnaires, jamais depuis un fichier de route.
 */
export async function readSiteTexts(): Promise<Record<string, string>> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        // Les clés sb_ sont opaques (pas des JWT) : on envoie apikey, pas Authorization bearer.
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabasePublic.from("site_texts").select("key, value");
  if (error) throw new Error(`Lecture des textes du site impossible : ${error.message}`);

  const texts: Record<string, string> = {};
  for (const row of data ?? []) texts[row.key] = row.value;
  return texts;
}
