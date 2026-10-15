import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, Inbox, MapPin, Trash2, X } from "lucide-react";
import { listAllOrders, orderAction, setOrderStatus, type Order } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { brl, getProduct } from "@/lib/products";
import { useText } from "@/lib/content";

const STATUS_VALUES = ["nouveau", "prepare", "envoye", "livre", "annule"] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Commandes reçues — Vcampro" },
      { name: "description", content: "Les commandes passées sur la boutique Vcampro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Commandes reçues — Vcampro" },
      { property: "og:description", content: "Les commandes passées sur la boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOrders,
});

function tabOf(status: Order["status"]): "pending" | "done" | "refused" {
  if (status === "livre") return "done";
  if (status === "annule") return "refused";
  return "pending";
}

function AdminOrders() {
  const t = useText();
  const queryClient = useQueryClient();
  const changeStatus = useServerFn(setOrderStatus);
  const runAction = useServerFn(orderAction);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"pending" | "done" | "refused">("pending");

  const { data, error, isPending } = useQuery({
    queryKey: ["all-orders"],
    queryFn: () => listAllOrders(),
    retry: false,
  });

  if (error)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("admin.denied")}</p>
      </div>
    );

  if (isPending)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.loading")}</p>;

  if (data.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">{t("admin.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("admin.empty")}</p>
      </div>
    );

  async function act(id: string, action: "accept" | "refuse" | "ready" | "delete", msg?: string) {
    if (action === "delete" && !window.confirm(t("admin.deleteConfirm"))) return;
    setBusyId(id);
    try {
      const r = await runAction({ data: { id, action, ...(msg ? { message: msg } : {}) } });
      if (action !== "delete") {
        if (r.emailed) toast.success(t("admin.emailSent"));
        else toast.warning(t("admin.emailFailed"));
      }
      await queryClient.invalidateQueries({ queryKey: ["all-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function update(id: string, status: Order["status"]) {
    setBusyId(id);
    try {
      await changeStatus({ data: { id, status } });
      await queryClient.invalidateQueries({ queryKey: ["all-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La situation n'a pas pu être enregistrée.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("admin.intro")}</p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {(["pending", "done", "refused"] as const).map((k) => {
          const count = data.filter((o) => tabOf(o.status) === k).length;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${tab === k ? "bg-brand text-primary-foreground" : "bg-card text-muted-foreground"}`}
            >
              {t(`admin.tab.${k}`)}
              <span className={`rounded-full px-2 py-0.5 text-xs ${k === "pending" && count > 0 ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {data.filter((o) => tabOf(o.status) === tab).length === 0 && (
        <p className="mt-6 text-muted-foreground">{t("admin.tab.empty")}</p>
      )}

      <ul className="mt-6 space-y-4">
        {data.filter((o) => tabOf(o.status) === tab).map((o) => (
          <li key={o.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold">{o.ref}</p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.date")} : {new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                {t("admin.total")} : {brl(o.total)}
              </span>
              <span className="w-full text-sm">
                <span className="font-medium">{t(`pay.status.${o.payment_status}`)}</span>
                <span className="text-muted-foreground"> · {o.payment_plan === "split" ? t("pay.split") : t("pay.full")} · {brl(o.amount_paid)} / {brl(o.total)}</span>
                {o.second_charge_due_at && <span className="text-muted-foreground"> · {t("pay.secondOn")} {new Date(o.second_charge_due_at).toLocaleDateString("fr-FR")}</span>}
              </span>
            </div>

            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="font-medium">{t("admin.customer")}</p>
                <p className="text-muted-foreground">{o.name}</p>
                <p className="text-muted-foreground">{o.customer_email}</p>
                <p className="text-muted-foreground">{o.phone}</p>
              </div>
              <div>
                <p className="font-medium">{t("admin.address")}</p>
                <p className="text-muted-foreground">{t(`delivery.method.${o.delivery_method}`)}</p>
                {o.delivery_method === "livraison" && (
                  <>
                    <p className="text-muted-foreground">{o.address}</p>
                    <p className="text-muted-foreground">{o.postal_code}</p>
                  </>
                )}
                {o.notes && (
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">{t("admin.notes")} :</span> {o.notes}
                  </p>
                )}
              </div>
              <div>
                <p className="font-medium">{t("admin.items")}</p>
                <ul className="mt-1 space-y-1">
                  {o.items.map((item) => {
                    const p = getProduct(item.id);
                    const name = t(`product.${item.id}.name`);
                    return (
                      <li key={item.id} className="flex items-center gap-2 text-muted-foreground">
                        {p && <img src={p.image} alt={name} width={p.imageW} height={p.imageH} className="h-8 w-auto object-contain" />}
                        {name} × {item.qty}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm">
              <span className="font-medium">{t("admin.status")}</span>
              <select
                value={o.status}
                disabled={busyId === o.id}
                onChange={(e) => update(o.id, e.target.value as Order["status"])}
                className="rounded-xl border bg-background px-3 py-2 text-sm"
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="bg-brand" disabled={busyId === o.id} onClick={() => act(o.id, "accept")}>
                <Check className="mr-1 h-4 w-4" />{t("admin.accept")}
              </Button>
              {o.status !== "livre" && o.status !== "annule" && (
                <Button size="sm" variant="secondary" disabled={busyId === o.id} onClick={() => update(o.id, "livre")}>
                  <CheckCheck className="mr-1 h-4 w-4" />{t("admin.complete")}
                </Button>
              )}
              {o.delivery_method === "retrait" && (
                <Button size="sm" variant="secondary" disabled={busyId === o.id} onClick={() => { setReadyFor(readyFor === o.id ? null : o.id); setMessage(""); }}>
                  <MapPin className="mr-1 h-4 w-4" />{t("admin.ready")}
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => act(o.id, "refuse")}>
                <X className="mr-1 h-4 w-4" />{t("admin.refuse")}
              </Button>
              <Button size="sm" variant="destructive" disabled={busyId === o.id} onClick={() => act(o.id, "delete")}>
                <Trash2 className="mr-1 h-4 w-4" />{t("admin.delete")}
              </Button>
            </div>

            {readyFor === o.id && (
              <div className="mt-4 space-y-2 rounded-xl border bg-background p-4">
                <p className="text-sm font-medium">{t("admin.readyMessageLabel")}</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={3000}
                  spellCheck
                  lang="fr"
                  placeholder={t("admin.readyMessagePlaceholder")}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
                <Button
                  size="sm"
                  className="bg-brand"
                  disabled={busyId === o.id || message.trim().length < 2}
                  onClick={async () => { await act(o.id, "ready", message.trim()); setReadyFor(null); }}
                >
                  {t("admin.readySend")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
