import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Vcampro" },
      { name: "description", content: "Définissez un nouveau mot de passe pour votre compte Vcampro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Nouveau mot de passe — Vcampro" },
      { property: "og:description", content: "Définissez un nouveau mot de passe pour votre compte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

const schema = z.object({
  password: z.string().min(8, "Mot de passe trop court (8 caractères minimum)").max(200),
});

function ResetPassword() {
  const t = useText();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const hasRecoveryLink = window.location.hash.includes("type=recovery");
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setReady(hasRecoveryLink || !!data.session);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse({ password });
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? "Mot de passe trop court");
      return;
    }
    setBusy(true);
    // La session de récupération est déjà valable : current_password n'est pas demandé ici.
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("Ce lien a expiré. Demandez un nouveau lien de réinitialisation.");
      return;
    }
    toast.success("Mot de passe enregistré.");
    navigate({ to: "/mes-commandes" });
  }

  if (!ready)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{t("auth.resetTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("auth.resetMissing")}</p>
        <Button asChild className="mt-6 bg-brand">
          <Link to="/auth">{t("auth.signIn")}</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">{t("auth.resetTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("auth.resetIntro")}</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border bg-card p-6">
        <div>
          <Label htmlFor="new-password">{t("auth.password")}</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} />
        </div>
        <Button type="submit" size="lg" disabled={busy} className="w-full bg-brand shadow-glow">
          {busy ? "…" : t("auth.reset")}
        </Button>
      </form>
    </div>
  );
}
