import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useText } from "@/lib/content";
import { takeIntendedPath } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Connexion et création de compte — Vcampro" },
      { name: "description", content: "Créez un compte Vcampro pour commander et suivre vos commandes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Espace client — Vcampro" },
      { property: "og:description", content: "Créez un compte pour commander et suivre vos commandes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

const OWNER_LOGIN = "vcamprovendas";
const OWNER_EMAIL = "vcampro00@gmail.com";

const schema = z.object({
  email: z.string().trim().email("E-mail invalide").max(255),
  password: z.string().min(8, "Mot de passe trop court (8 caractères minimum)").max(200),
});

function Auth() {
  const t = useText();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const set = (k: "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Identifiant du propriétaire : « Vcamprovendas » se connecte au compte administrateur.
    const ident = form.email.trim().toLowerCase();
    const email = mode === "signin" && ident === OWNER_LOGIN ? OWNER_EMAIL : form.email;
    const r = schema.safeParse({ ...form, email });
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? "Vérifiez vos informations");
      return;
    }
    setBusy(true);
    setNotice("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      // La confirmation par e-mail est activée : aucun compte n'est connecté avant le clic sur le lien.
      if (!data.session) {
        setNotice(t("auth.checkEmail"));
        return;
      }
      navigate({ to: "/mes-commandes" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const target = (takeIntendedPath() ?? "/mes-commandes") as "/mes-commandes";
    navigate({ to: target });
  }

  async function forgot() {
    const email = form.email.trim();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Écrivez d'abord votre e-mail ci-dessus");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    if (error) toast.error(error.message);
    else setNotice(t("auth.forgotSent"));
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">{t("auth.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("auth.intro")}</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border bg-card p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => { setMode("signup"); setNotice(""); }}
          className={`rounded-full px-4 py-2 ${mode === "signup" ? "bg-brand text-primary-foreground" : "text-muted-foreground"}`}
        >
          {t("auth.signUpTitle")}
        </button>
        <button
          type="button"
          onClick={() => { setMode("signin"); setNotice(""); }}
          className={`rounded-full px-4 py-2 ${mode === "signin" ? "bg-brand text-primary-foreground" : "text-muted-foreground"}`}
        >
          {t("auth.signInTitle")}
        </button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border bg-card p-6">
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type={mode === "signin" ? "text" : "email"} autoComplete={mode === "signin" ? "username" : "email"} value={form.email} onChange={set("email")} maxLength={255} />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={form.password} onChange={set("password")} maxLength={200} />
        </div>

        {notice && <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">{notice}</p>}

        <Button type="submit" size="lg" disabled={busy} className="w-full bg-brand shadow-glow">
          {busy ? "…" : mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
        </Button>

        <button type="button" onClick={forgot} className="w-full text-center text-xs underline decoration-dotted underline-offset-4 text-muted-foreground hover:text-foreground">
          {t("auth.forgot")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            {t("auth.haveAccount")}{" "}
            <button type="button" onClick={() => setMode("signin")} className="underline underline-offset-4 hover:text-foreground">
              {t("auth.signIn")}
            </button>
          </>
        ) : (
          <>
            {t("auth.noAccount")}{" "}
            <button type="button" onClick={() => setMode("signup")} className="underline underline-offset-4 hover:text-foreground">
              {t("auth.signUp")}
            </button>
          </>
        )}
      </p>

      <p className="mt-8 text-center">
        <Link to="/" className="text-xs underline decoration-dotted underline-offset-4 hover:text-foreground">
          {t("home.ctaPrimary")}
        </Link>
      </p>
    </div>
  );
}
