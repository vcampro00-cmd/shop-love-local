import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getOrder } from "@/lib/orders.functions";
import { brl, getProduct } from "@/lib/products";
import { useText, numFromText } from "@/lib/content";
import { Button } from "@/components/ui/button";

const orderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/pedido/$id")({
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
});

function Confirmed() {
  const { id } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQueryOptions(id));
  const t = useText();

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

      <div className="mt-8 space-y-4 rounded-2xl border bg-card p-5 text-left text-sm">
        <div>
          <p className="font-bold">{t("account.orderItems")}</p>
          <ul className="mt-2 space-y-1">
            {order.items.map((item) => {
              const p = getProduct(item.id);
              const name = t(`product.${item.id}.name`);
              const price = numFromText(t(`product.${item.id}.price`), 0);
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
            {order.address}, {order.postal_code}
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
