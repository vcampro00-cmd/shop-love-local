import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import { listMyOrders } from "@/lib/orders.functions";
import { brl } from "@/lib/products";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";

const myOrdersQueryOptions = queryOptions({
  queryKey: ["my-orders"],
  queryFn: () => listMyOrders(),
});

export const Route = createFileRoute("/_authenticated/mes-commandes")({
  staticData: { sitemap: false },
  loader: ({ context }) => context.queryClient.ensureQueryData(myOrdersQueryOptions),
  head: () => ({
    meta: [
      { title: "Mes commandes — Vcampro" },
      { name: "description", content: "Suivez vos commandes Vcampro et leur situation." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Mes commandes — Vcampro" },
      { property: "og:description", content: "Suivez vos commandes et leur situation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { data } = useSuspenseQuery(myOrdersQueryOptions);
  const t = useText();

  if (data.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-bold">{t("account.ordersTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("account.ordersEmpty")}</p>
        <Button asChild className="mt-6 bg-brand">
          <Link to="/">{t("account.ordersCta")}</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("account.ordersTitle")}</h1>
      <ul className="mt-6 space-y-4">
        {data.map((o) => (
          <li key={o.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{o.ref}</p>
                <p className="text-xs text-muted-foreground">
                  {t("account.orderDate")} : {new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <span className="flex flex-col items-end gap-1 text-xs">
                <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{t(`status.${o.status}`)}</span>
                <span className="text-muted-foreground">{t(`pay.status.${o.payment_status}`)}</span>
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-bold">{t("account.orderTotal")} : {brl(o.total)}</span>
              <Button asChild size="sm" className="bg-brand">
                <Link to="/pedido/$id" params={{ id: o.id }}>{t("account.viewOrder")}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
