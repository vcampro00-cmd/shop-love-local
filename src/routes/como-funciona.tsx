import { createFileRoute } from "@tanstack/react-router";
import { useText } from "@/lib/content";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Comment commander — Vcampro" },
      { name: "description", content: "Étapes pour commander chez Vcampro : panier, adresse de livraison et paiement en ligne." },
      { property: "og:title", content: "Comment commander — Vcampro" },
      { property: "og:description", content: "Comprenez comment passer commande chez Vcampro." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [1, 2, 3, 4, 5];

function HowItWorks() {
  const t = useText();
  const steps = STEPS.map((n) => ({ n, t: t(`steps.${n}.title`), d: t(`steps.${n}.text`) }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold">{t("steps.titleA")} <span className="text-brand">{t("steps.titleB")}</span></h1>
      <p className="mt-3 text-muted-foreground">{t("steps.intro")}</p>
      <ol className="mt-10 space-y-4">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4 rounded-2xl border bg-card p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-primary-foreground">{s.n}</span>
            <div><h2 className="font-bold">{s.t}</h2><p className="text-sm text-muted-foreground">{s.d}</p></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
