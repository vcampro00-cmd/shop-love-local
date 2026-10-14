import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Zone réservée : les pages qui demandent un compte sont sous ce fichier.
// ssr: false parce que la session vit dans le navigateur, pas sur le serveur.
export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
