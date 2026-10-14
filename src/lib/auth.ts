import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccount } from "./orders.functions";

/** Utilisateur connecté, lu dans la session du navigateur (jamais pendant le rendu serveur). */
export function useAuthUser() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/** Compte + rôle administrateur, seulement quand une session existe. */
export function useAccount() {
  const { user, loading } = useAuthUser();
  const { data } = useQuery({
    queryKey: ["account"],
    queryFn: () => getAccount(),
    enabled: !!user && typeof window !== "undefined",
    staleTime: 60_000,
    retry: false,
  });

  return { user, loading, email: user?.email ?? "", isAdmin: !!data?.isAdmin };
}

const INTENDED_KEY = "vcampro-after-auth";

/** Chemin interne à retrouver après une connexion. Les URL extérieures sont rejetées. */
export function rememberIntendedPath(path: string) {
  if (typeof window === "undefined") return;
  if (!path.startsWith("/") || path.startsWith("//")) return;
  sessionStorage.setItem(INTENDED_KEY, path);
}

export function takeIntendedPath(): string | null {
  if (typeof window === "undefined") return null;
  const path = sessionStorage.getItem(INTENDED_KEY);
  sessionStorage.removeItem(INTENDED_KEY);
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}
