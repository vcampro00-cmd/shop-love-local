import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/products";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pedido/$id")({
  validateSearch: z.object({ t: z.number().catch(0) }),
  head: () => ({
    meta: [
      { title: "Commande confirmée — Vcampro" },
      { name: "description", content: "Votre commande Vcampro a bien été reçue." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Commande confirmée — Vcampro" },
      { property: "og:description", content: "Votre commande Vcampro a bien été reçue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Confirmed,
});

function Confirmed() {
  const { id } = Route.useParams();
  const { t } = Route.useSearch();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
      <h1 className="mt-6 text-3xl font-bold">Commande reçue !</h1>
      <p className="mt-2 text-muted-foreground">Numéro de commande : <span className="font-bold text-foreground">{id}</span> · Total {brl(t)}</p>
      <div className="mt-8 rounded-2xl border bg-card p-5 text-left text-sm">
        Votre commande sera préparée puis envoyée à l'adresse indiquée. Nous vous prévenons par téléphone à l'expédition.
      </div>
      <Button asChild className="mt-8 bg-brand"><Link to="/">Continuer mes achats</Link></Button>
    </div>
  );
}
