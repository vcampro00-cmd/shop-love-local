import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { startPayment } from "@/lib/orders.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useText } from "@/lib/content";
import { useX } from "@/lib/lang";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/paiement/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Paiement de la commande — Vcampro" },
      { name: "description", content: "Payez votre commande Vcampro par carte bancaire." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Paiement — Vcampro" },
      { property: "og:description", content: "Payez votre commande Vcampro par carte bancaire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayOrder,
});

function PayOrder() {
  const { id } = Route.useParams();
  const t = useText();
  const x = useX();
  const start = useServerFn(startPayment);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    try {
      const r = await start({ data: { id, environment: getStripeEnvironment(), origin: window.location.origin } });
      if ("error" in r) throw new Error(r.error);
      return r.clientSecret;
    } catch (e) {
      setError(e instanceof Error ? e.message : x("Paiement impossible.", "Pagamento indisponível."));
      throw e;
    }
  }, [id, start]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t("pay.title")}</h1>
      {error ? (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button asChild className="mt-4 bg-brand"><Link to="/pedido/$id" params={{ id }}>{t("account.viewOrder")}</Link></Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  );
}
