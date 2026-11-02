import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Save, Sparkles } from "lucide-react";
import { DEFAULTS, EDITOR_GROUPS } from "@/lib/content.defaults";
import { DEFAULTS_PT } from "@/lib/content.defaults.pt";
import { ptKey } from "@/lib/content";
import { checkEditCode, saveSiteTexts } from "@/lib/content.functions";
import { siteTextsQueryOptions } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/editar")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Espace propriétaire — Vcampro" },
      { name: "description", content: "Écrivez les textes de votre boutique Vcampro et enregistrez-les." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Espace propriétaire — Vcampro" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Editor,
});

const CODE_KEY = "vcampro-edit-code";

function Editor() {
  const { data: saved } = useSuspenseQuery(siteTextsQueryOptions);
  const queryClient = useQueryClient();
  const save = useServerFn(saveSiteTexts);

  const [code, setCode] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Langue en cours d'écriture : les textes portugais sont enregistrés avec le suffixe __pt.
  const [editLang, setEditLang] = useState<"fr" | "pt">("fr");
  const check = useServerFn(checkEditCode);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Le code n'est plus mémorisé : il faut le taper à chaque visite.
    localStorage.removeItem(CODE_KEY);
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const r = await check({ data: { code: code.trim() } });
      if (r.ok) setUnlocked(true);
      else toast.error("Code d'accès incorrect.");
    } finally {
      setChecking(false);
    }
  }

  const touched = useMemo(() => Object.keys(values).length, [values]);

  function field(key: string) {
    return values[ptKeyFor(key)] ?? saved?.[ptKeyFor(key)] ?? "";
  }

  function ptKeyFor(key: string) {
    return editLang === "pt" ? ptKey(key) : key;
  }

  // Valeur par défaut affichée comme exemple : la traduction portugaise en mode português.
  function defVal(key: string) {
    return (editLang === "pt" ? DEFAULTS_PT[key] : DEFAULTS[key]) ?? "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Entrez votre code d'accès pour enregistrer.");
      return;
    }
    if (touched === 0) {
      toast.error("Écrivez au moins un texte avant d'enregistrer.");
      return;
    }

    const texts: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) texts[key] = value.trim();

    setSaving(true);
    try {
      const result = await save({ data: { code: code.trim(), texts } });
      queryClient.invalidateQueries({ queryKey: siteTextsQueryOptions.queryKey });
      setValues({});
      toast.success(`${result.saved} texte(s) enregistré(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  if (!unlocked)
    return (
      <form onSubmit={unlock} className="mx-auto max-w-md px-4 py-24">
        <h1 className="text-2xl font-bold">Espace <span className="text-brand">propriétaire</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Entrez votre code d'accès pour continuer.</p>
        <div className="mt-6 space-y-4 rounded-3xl border bg-card p-6">
          <Label htmlFor="unlock-code" className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-accent" /> Code d'accès</Label>
          <Input id="unlock-code" type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" maxLength={80} />
          <Button type="submit" size="lg" className="w-full bg-brand shadow-glow" disabled={checking}>{checking ? "…" : "Entrer"}</Button>
        </div>
      </form>
    );

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Écrire sur le <span className="text-brand">site</span></h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Écrivez comme vous voulez, en français ou en portugais. Enregistrez, puis envoyez-moi
            « corrige » dans le chat : je corrige la façon d'écrire et je garde vos mots.
          </p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/">Voir le site</Link></Button>
      </div>

      <div className="mt-4 inline-flex rounded-full border bg-card p-1 text-sm font-medium">
        <button type="button" onClick={() => setEditLang("fr")} className={`rounded-full px-4 py-2 ${editLang === "fr" ? "bg-brand text-primary-foreground" : "text-muted-foreground"}`}>
          Français
        </button>
        <button type="button" onClick={() => setEditLang("pt")} className={`rounded-full px-4 py-2 ${editLang === "pt" ? "bg-brand text-primary-foreground" : "text-muted-foreground"}`}>
          Português (Brasil)
        </button>
      </div>
      {editLang === "pt" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Textos em português: o que você deixar vazio usa a tradução automática. Os campos de preço são iguais nas duas línguas.
        </p>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="text-muted-foreground">
          Laissez un champ vide pour garder la valeur actuelle. Une case marquée « modifié par vous »
          reprend votre dernière saisie.
        </p>
      </div>

      <div className="mt-6 flex items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="flex-1">
          <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-accent" /> Code d'accès</Label>
          <Input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            placeholder="Code donné par Lovable"
            className="mt-2"
          />
        </div>
        <Button type="submit" size="lg" className="bg-brand shadow-glow" disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      {touched > 0 && (
        <p className="mt-3 text-sm text-brand">{touched} champ(s) en attente d'enregistrement.</p>
      )}

      <div className="mt-8 space-y-8">
        {EDITOR_GROUPS.map((group) => {
          // Les prix sont communs aux deux langues : pas de champ prix en mode português.
          const fields = editLang === "pt" ? group.fields.filter((f) => f.kind !== "money") : group.fields;
          return (
          <section key={group.title} className="rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-bold">{group.title}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const value = field(f.key);
                const isCustom = Boolean(saved?.[ptKeyFor(f.key)]?.trim());
                return (
                  <div key={f.key} className={f.kind === "long" ? "sm:col-span-2" : ""}>
                    <Label className="flex items-center gap-2">
                      {f.label}
                      {isCustom && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] text-brand">modifié par vous</span>}
                    </Label>
                    {f.kind === "long" ? (
                      <Textarea
                        className="mt-2"
                        value={value}
                        maxLength={1000}
                        placeholder={defVal(f.key)}
                        onChange={(e) => setValues((v) => ({ ...v, [ptKeyFor(f.key)]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        className="mt-2"
                        value={value}
                        maxLength={200}
                        inputMode={f.kind === "money" ? "decimal" : undefined}
                        placeholder={defVal(f.key)}
                        onChange={(e) => setValues((v) => ({ ...v, [ptKeyFor(f.key)]: e.target.value }))}
                      />
                    )}
                    {!isCustom && defVal(f.key) && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">Actuel : {defVal(f.key)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <Button type="submit" size="lg" className="bg-brand shadow-glow" disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer mes textes"}
        </Button>
      </div>
    </form>
  );
}
