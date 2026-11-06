import { createFileRoute } from "@tanstack/react-router";

// Vidéo de la page d'accueil : le fichier est dans un espace de stockage privé,
// on redirige vers un lien signé temporaire (lecture publique, aucune écriture).
export const Route = createFileRoute("/video/$")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!/^home\/[A-Za-z0-9._-]{1,120}$/.test(path)) return new Response("Vidéo introuvable.", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("site-media").createSignedUrl(path, 60 * 60 * 6);
        if (error || !data) return new Response("Vidéo introuvable.", { status: 404 });
        return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
