import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, Inbox, MapPin, Trash2, X } from "lucide-react";
import { formatVisionxCode, isVisionxCode } from "@/lib/phone";
import { todayParis } from "@/lib/cash";
import { whatsappDigits } from "@/lib/cash";
import { cancelSecondPayment, resendCancelReceipt, chargeSecondPaymentNow, listAllOrders, orderAction, setOrderPhone, setOrderStatus, setOrderVisionx, setSecondChargeDate, type Order } from "@/lib/orders.functions";
import { concludeSale, getInventory } from "@/lib/inventory.functions";
import { correctText } from "@/lib/correct.functions";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
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
  const catalog = useCatalog();
  const queryClient = useQueryClient();
  const changeStatus = useServerFn(setOrderStatus);
  const cancelSecondFn = useServerFn(cancelSecondPayment);
  const resendReceiptFn = useServerFn(resendCancelReceipt);
  const chargeNowFn = useServerFn(chargeSecondPaymentNow);
  const runAction = useServerFn(orderAction);
  const correct = useServerFn(correctText);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const correctTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<"pending" | "done" | "refused">("pending");
  const runConclude = useServerFn(concludeSale);
  const fetchInv = useServerFn(getInventory);
  const inv = useQuery({ queryKey: ["inventory"], queryFn: () => fetchInv() });
  const [sellFor, setSellFor] = useState<string | null>(null);
  const [seller, setSeller] = useState("");

  /** Corrige l'orthographe et la ponctuation automatiquement, 1,5 s après la dernière frappe. */
  function onMessageChange(value: string) {
    setMessage(value);
    if (correctTimer.current) clearTimeout(correctTimer.current);
    const snapshot = value;
    if (snapshot.trim().length < 3) return;
    correctTimer.current = setTimeout(async () => {
      try {
        const res = await correct({ data: { text: snapshot } });
        // Ne remplace le texte que si le propriétaire n'a pas continué à écrire entre-temps.
        if ("corrected" in res) setMessage((cur) => (cur === snapshot ? res.corrected : cur));
      } catch { /* correcteur indisponible : on garde le texte tel quel */ }
    }, 1500);
  }

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

  async function conclude(id: string) {
    setBusyId(id);
    try {
      const r = await runConclude({ data: { id, sellerId: seller } });
      toast.success(`${t("admin.sellerDone")} ${r.seller} : ${brl(r.commission)}`);
      setSellFor(null);
      setSeller("");
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

  async function chargeNow(id: string) {
    if (!window.confirm(t("admin.chargeNow.confirm"))) return;
    setBusyId(id);
    try {
      const r = await chargeNowFn({ data: { id } });
      if ("error" in r) throw new Error(r.error);
      toast.success(t("admin.chargeNow.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      setBusyId(null);
    }
  }

  async function resendReceipt(id: string) {
    setBusyId(id);
    try {
      await resendReceiptFn({ data: { id } });
      toast.success(t("admin.cancelReceipt.sent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  /** Renonce au 2e prélèvement : il ne sera plus tenté ni affiché comme dû. */
  async function cancelSecond(id: string) {
    if (!window.confirm(t("admin.cancelSecond.confirm"))) return;
    setBusyId(id);
    try {
      await cancelSecondFn({ data: { id } });
      toast.success(t("admin.cancelSecond.saved"));
      await queryClient.invalidateQueries({ queryKey: ["all-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
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
                {o.seller_id && (
                  <p className="mt-1 text-sm font-semibold text-accent">
                    {t("stock.promoSeller")} : {inv.data?.sellers.find((s) => s.id === o.seller_id)?.name ?? "?"}
                    {o.promo_code && ` (${o.promo_code})`}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                {t("admin.total")} : {brl(o.total)}
              </span>
              <span className="w-full text-sm">
                <span className="font-medium">{t(`pay.status.${o.payment_status}`)}</span>
                <span className="text-muted-foreground"> · {o.payment_method === "especes" ? t("pay.cash") : o.payment_plan === "split" ? t("pay.split") : t("pay.full")} · {brl(o.amount_paid)} / {brl(o.total)}</span>
                {o.second_charge_due_at && <span className="text-muted-foreground"> · {t("pay.secondOn")} {new Date(o.second_charge_due_at).toLocaleDateString("fr-FR")}</span>}
              </span>
            </div>

            {o.payment_plan === "split" && (
              <VisionxCode order={o} onSaved={() => queryClient.invalidateQueries({ queryKey: ["all-orders"] })} />
            )}

            {o.payment_plan === "split" && (o.payment_status === "acompte_paye" || o.payment_status === "en_attente") && (
              <SecondChargeDate order={o} onSaved={() => queryClient.invalidateQueries({ queryKey: ["all-orders"] })} />
            )}

            {o.payment_plan === "split" && (o.payment_status === "acompte_paye" || o.payment_status === "echec_solde") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(o.payment_status === "echec_solde" || !o.second_charge_due_at || o.second_charge_due_at.slice(0, 10) <= todayParis()) && (
                  <Button size="sm" className="bg-brand" disabled={busyId === o.id} onClick={() => chargeNow(o.id)}>
                    {t("admin.chargeNow.button")}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => cancelSecond(o.id)}>
                  <X className="mr-1 h-4 w-4" />{t("admin.cancelSecond.button")}
                </Button>
              </div>
            )}

            {o.payment_plan === "split" && o.payment_status === "solde_annule" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/annulation/${o.cancel_token}`} target="_blank" rel="noreferrer">{t("admin.cancelReceipt.pdf")}</a>
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => resendReceipt(o.id)}>
                  {t("admin.cancelReceipt.email")}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://wa.me/${whatsappDigits(o.phone)}?text=${encodeURIComponent(`Bonjour ${o.name}, le 2e paiement de votre commande ${o.ref} a été annulé : aucun prélèvement ne sera plus effectué. Votre justificatif : https://vcampro.shop/annulation/${o.cancel_token}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("admin.cancelReceipt.whatsapp")}
                  </a>
                </Button>
              </div>
            )}

            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="font-medium">{t("admin.customer")}</p>
                <p className="text-muted-foreground">{o.name}</p>
                <p className="text-muted-foreground">{o.customer_email}</p>
                <OrderPhone order={o} onSaved={() => queryClient.invalidateQueries({ queryKey: ["all-orders"] })} />
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
                    const p = catalog.get(item.id);
                    const name = p?.name ?? item.id;
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
                <Button size="sm" variant="secondary" disabled={busyId === o.id} onClick={() => { setSellFor(sellFor === o.id ? null : o.id); setSeller(o.seller_id ?? ""); }}>
                  <CheckCheck className="mr-1 h-4 w-4" />{t("admin.complete")}
                </Button>
              )}
              {sellFor === o.id && (
                <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">{t("admin.sellerQuestion")}</span>
                  <select value={seller} onChange={(e) => setSeller(e.target.value)} className="rounded-xl border bg-background px-3 py-2">
                    <option value="">—</option>
                    {(inv.data?.sellers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Button size="sm" className="bg-brand" disabled={!seller || busyId === o.id} onClick={() => conclude(o.id)}>
                    {t("admin.sellerConfirm")}
                  </Button>
                  {(inv.data?.sellers ?? []).length === 0 && <span className="text-muted-foreground">{t("admin.sellerNone")}</span>}
                </div>
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
                  onChange={(e) => onMessageChange(e.target.value)}
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

function VisionxCode({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const t = useText();
  const save = useServerFn(setOrderVisionx);
  const [code, setCode] = useState(order.visionx_code ? formatVisionxCode(order.visionx_code) : "");
  const [busy, setBusy] = useState(false);
  const clean = code.replace(/-/g, "").trim().toUpperCase();
  const valid = isVisionxCode(clean);
  const changed = clean !== (order.visionx_code ?? "").replace(/-/g, "");
  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
      <p className="font-bold">{t("admin.visionx.label")}</p>
      <p className="text-xs text-muted-foreground">{t("admin.visionx.hint")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => {
            const letters = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/-/g, "");
            setCode(formatVisionxCode(letters));
          }}
          maxLength={64}
          aria-label={t("admin.visionx.label")}
          className="w-56 rounded-xl border bg-background px-3 py-1.5 font-mono text-sm"
        />
        {changed && (
          <Button
            size="sm"
            className="bg-brand"
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              try {
                await save({ data: { id: order.id, code: code.replace(/[^A-Z0-9-]/g, "") } });
                toast.success(t("admin.visionx.saved"));
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Code invalide.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("admin.visionx.save")}
          </Button>
        )}
      </div>
    </div>
  );
}

function OrderPhone({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const t = useText();
  const save = useServerFn(setOrderPhone);
  const [phone, setPhone] = useState(order.phone ?? "");
  const [busy, setBusy] = useState(false);
  const changed = phone.trim() !== (order.phone ?? "") && phone.trim().length >= 8;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        aria-label={t("admin.phone.label")}
        className="w-40 rounded-xl border bg-background px-3 py-1.5 text-sm"
      />
      {changed && (
        <Button
          size="sm"
          className="bg-brand"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({ data: { id: order.id, phone: phone.trim() } });
              toast.success(t("admin.phone.saved"));
              onSaved();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Téléphone invalide.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("admin.phone.save")}
        </Button>
      )}
    </div>
  );
}

function SecondChargeDate({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const t = useText();
  const save = useServerFn(setSecondChargeDate);
  const current = order.second_charge_due_at?.slice(0, 10) ?? "";
  const [date, setDate] = useState(current);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
      <span className="font-medium">{t("admin.secondDate.label")}</span>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-xl border bg-background px-3 py-2"
      />
      <Button
        size="sm"
        className="bg-brand"
        disabled={busy || !date || date === current}
        onClick={async () => {
          setBusy(true);
          try {
            await save({ data: { id: order.id, date } });
            toast.success(t("admin.secondDate.saved"));
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Date impossible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("admin.secondDate.save")}
      </Button>
      {current && (
        <span className="text-muted-foreground">
          {t("pay.secondOn")} {new Date(order.second_charge_due_at!).toLocaleDateString("fr-FR")}
        </span>
      )}
    </div>
  );
}
