import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/products";
import { useText } from "@/lib/content";
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
  const { t: total } = Route.useSearch();
  const t = useText();

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
      <h1 className="mt-6 text-3xl font-bold">{t("order.title")}</h1>
      <p className="mt-2 text-muted-foreground">Numéro de commande : <span className="font-bold text-foreground">{id}</span> · Total {brl(total)}</p>
      <div className="mt-8 rounded-2xl border bg-card p-5 text-left text-sm">{t("order.info")}</div>
      <Button asChild className="mt-8 bg-brand"><Link to="/">{t("order.continue")}</Link></Button>
    </div>
  );
}
