import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { getOrder, confirmPayment } from "@/lib/orders.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { brl } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { useText, numFromText } from "@/lib/content";
import { Button } from "@/components/ui/button";

const orderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQueryOptions(params.id)),
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
  errorComponent: () => (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Commande introuvable</h1>
      <p className="mt-2 text-muted-foreground">Cette commande n'existe pas ou a été supprimée.</p>
      <Button asChild className="mt-6"><Link to="/mes-commandes">Mes commandes</Link></Button>
    </div>
  ),
});

function Confirmed() {
  const { id } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQueryOptions(id));
  const t = useText();
  const catalog = useCatalog();
  const { session_id } = Route.useSearch();
  const confirm = useServerFn(confirmPayment);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session_id || order.payment_status !== "en_attente") return;
    confirm({ data: { id, sessionId: session_id, environment: getStripeEnvironment() } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["order", id] }))
      .catch(() => {});
  }, [session_id, id, order.payment_status, confirm, queryClient]);

  const fee = numFromText(t("delivery.fee"), 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
      <h1 className="mt-6 text-3xl font-bold">{t("order.title")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("account.orderRef")} : <span className="font-bold text-foreground">{order.ref}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("account.orderStatus")} : <span className="font-medium text-foreground">{t(`status.${order.status}`)}</span>
      </p>

      <p className="mt-1 text-sm text-muted-foreground">
        {t(`pay.status.${order.payment_status}`)} · {order.payment_method === "especes" ? t("pay.cash") : order.payment_plan === "split" ? t("pay.split") : t("pay.full")} · {brl(order.amount_paid)} / {brl(order.total)}
        {order.second_charge_due_at && <> · {t("pay.secondOn")} {new Date(order.second_charge_due_at).toLocaleDateString("fr-FR")}</>}
      </p>
      {order.payment_status === "en_attente" && order.payment_method !== "especes" && !session_id && (
        <Button asChild className="mt-4 bg-brand shadow-glow">
          <Link to="/paiement/$id" params={{ id }}>{t("pay.payNow")}</Link>
        </Button>
      )}

      <div className="mt-8 space-y-4 rounded-2xl border bg-card p-5 text-left text-sm">
        <div>
          <p className="font-bold">{t("account.orderItems")}</p>
          <ul className="mt-2 space-y-1">
            {order.items.map((item) => {
              const p = catalog.get(item.id);
              const name = p?.name ?? item.id;
              const price = p?.price ?? 0;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {p && <img src={p.image} alt={name} width={p.imageW} height={p.imageH} className="h-10 w-auto object-contain" />}
                    {name} × {item.qty}
                  </span>
                  <span>{brl(price * item.qty)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>{brl(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>{t("delivery.label")}</span><span>{brl(order.delivery_fee || fee)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>{t("cart.total")}</span><span>{brl(order.total)}</span></div>
        </div>

        <div className="border-t pt-3">
          <p className="font-bold">{t("account.orderAddress")}</p>
          <p className="mt-1 text-muted-foreground">
            {order.name} · {order.phone}
            <br />
            {t(`delivery.method.${order.delivery_method}`)}
            {order.delivery_method === "livraison" && (
              <>
                <br />
                {order.address}, {order.postal_code}
              </>
            )}
          </p>
          {order.notes && (
            <p className="mt-2 text-muted-foreground">
              <span className="font-medium text-foreground">{t("account.orderNotes")} :</span> {order.notes}
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">{t("order.info")}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-brand">
          <Link to="/mes-commandes">{t("account.back")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">{t("order.continue")}</Link>
        </Button>
      </div>
    </div>
  );
}
