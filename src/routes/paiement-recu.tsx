import { createFileRoute, Link } from "@tanstack/react-router";
import { useX } from "@/lib/lang";

// Page où Stripe renvoie le client après avoir payé un rappel via le lien /pagar.
export const Route = createFileRoute("/paiement-recu")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { paiement?: string | undefined } => ({
    paiement: search["paiement"] === "annule" ? "annule" : search["paiement"] === "ok" ? "ok" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Paiement confirmé — Vcampro" },
      { name: "description", content: "Confirmation du paiement reçu par Vcampro." },
      { property: "og:title", content: "Paiement confirmé — Vcampro" },
      { property: "og:description", content: "Confirmation du paiement reçu par Vcampro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaiementRecu,
});

function PaiementRecu() {
  const { paiement } = Route.useSearch();
  const x = useX();
  const annule = paiement !== "ok";
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
          annule ? "bg-destructive/15 text-destructive" : "bg-brand/15 text-brand"
        }`}
      >
        {annule ? "✕" : "✓"}
      </div>
      <h1 className="mt-6 text-3xl font-bold">
        {annule ? x("Paiement annulé", "Pagamento cancelado") : x("Paiement confirmé, merci !", "Pagamento confirmado, obrigado!")}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {annule
          ? x("Aucun montant n'a été débité. Vous pouvez rouvrir le lien reçu sur WhatsApp pour réessayer.", "Nenhum valor foi debitado. Você pode reabrir o link recebido no WhatsApp para tentar de novo.")
          : x("Votre paiement a bien été reçu par Vcampro. Vous pouvez fermer cette page, rien d'autre est à faire.", "Seu pagamento foi recebido pela Vcampro. Você pode fechar esta página, nada mais precisa fazer.")}
      </p>
      <Link to="/" className="mt-8 rounded-xl bg-brand px-6 py-3 font-bold text-primary-foreground">
        {x("Retour à l'accueil", "Voltar ao início")}
      </Link>
    </div>
  );
}
