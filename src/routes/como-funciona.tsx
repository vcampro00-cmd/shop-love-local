import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_FEE, brl } from "@/lib/products";

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

const steps = [
  { t: "Choisissez vos téléphones", d: "Ajoutez au panier les téléphones souhaités et ajustez les quantités." },
  { t: "Livraison à votre adresse", d: `Faites-vous livrer à l'adresse indiquée (frais de ${brl(DELIVERY_FEE)}).` },
  { t: "Remplissez vos informations", d: "Indiquez nom, téléphone et adresse complète de livraison." },
  { t: "Payez sur le site", d: "Réglez votre commande en ligne en toute sécurité." },
  { t: "Suivez votre commande", d: "Vous recevez un numéro de commande. Nous vous prévenons quand elle est en route." },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold">Comment <span className="text-brand">commander</span></h1>
      <p className="mt-3 text-muted-foreground">Acheter chez Vcampro est simple. Voici les étapes :</p>
      <ol className="mt-10 space-y-4">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-4 rounded-2xl border bg-card p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-primary-foreground">{i + 1}</span>
            <div><h2 className="font-bold">{s.t}</h2><p className="text-sm text-muted-foreground">{s.d}</p></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
