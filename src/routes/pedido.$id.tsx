import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/products";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pedido/$id")({
  validateSearch: z.object({ m: z.enum(["entrega", "retirada"]).catch("entrega"), t: z.number().catch(0) }),
  head: () => ({
    meta: [
      { title: "Pedido confirmado — Vcampro" },
      { name: "description", content: "Seu pedido na Vcampro foi recebido." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pedido confirmado — Vcampro" },
      { property: "og:description", content: "Seu pedido na Vcampro foi recebido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Confirmed,
});

function Confirmed() {
  const { id } = Route.useParams();
  const { m, t } = Route.useSearch();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
      <h1 className="mt-6 text-3xl font-bold">Pedido recebido!</h1>
      <p className="mt-2 text-muted-foreground">Número do pedido: <span className="font-bold text-foreground">{id}</span> · Total {brl(t)}</p>
      <div className="mt-8 rounded-2xl border bg-card p-5 text-left text-sm">
        {m === "entrega"
          ? "Seu pedido será preparado e enviado ao endereço informado. Avisaremos pelo telefone quando sair para entrega."
          : "Avisaremos pelo telefone quando o pedido estiver pronto. Para retirar, apresente o número do pedido e um documento com foto."}
      </div>
      <Button asChild className="mt-8 bg-brand"><Link to="/">Continuar comprando</Link></Button>
    </div>
  );
}
