import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Lecture publique des textes du site (aucune écriture possible par un visiteur :
// la table n'a pas de politique INSERT/UPDATE, seule la fonction protégée ci-dessous
// peut écrire, avec le code d'accès du propriétaire).
export const getSiteTexts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, string>> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      // Les clés sb_ sont opaques (pas des JWT) : on envoie apikey, pas Authorization bearer.
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data, error } = await supabasePublic.from("site_texts").select("key, value");
    if (error) {
      console.error("Lecture des textes du site impossible :", error.message);
      return {};
    }

    const texts: Record<string, string> = {};
    for (const row of data ?? []) texts[row.key] = row.value;
    return texts;
  },
);

const payload = z.object({
  code: z.string().min(1).max(80),
  texts: z.record(z.string().max(64), z.string().max(4000)),
});

export const saveSiteTexts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payload.parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_EDIT_CODE"];
    if (!expected) throw new Error("Le code d'accès n'est pas encore configuré.");
    if (data.code !== expected) throw new Error("Code d'accès incorrect.");

    const rows = Object.entries(data.texts)
      .filter(([key]) => /^[a-zA-Z0-9._-]{1,64}$/.test(key))
      .map(([key, value]) => ({ key, value }));

    if (rows.length === 0) return { saved: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_texts").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);

    return { saved: rows.length };
  });

// Vérifie le code d'accès avant d'ouvrir l'espace propriétaire (la comparaison reste côté serveur).
export const checkEditCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_EDIT_CODE"];
    return { ok: Boolean(expected) && data.code === expected };
  });
