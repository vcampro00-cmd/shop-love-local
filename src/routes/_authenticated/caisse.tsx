import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { addExpense, deleteExpense, getCashBook } from "@/lib/cash.functions";
import { summarizeCash, type CashEntry } from "@/lib/cash";
import { brl } from "@/lib/products";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/caisse")({
  head: () => ({
    meta: [
      { title: "Caisse — Vcampro" },
      { name: "description", content: "Entrées, sorties et gains nets de la boutique Vcampro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Caisse — Vcampro" },
      { property: "og:description", content: "Entrées, sorties et gains nets de la boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Caisse,
});

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

type Kind = "entree" | "sortie" | "achat";

const KINDS: { value: Kind; key: string }[] = [
  { value: "entree", key: "cash.kind.in" },
  { value: "sortie", key: "cash.kind.out" },
  { value: "achat", key: "cash.kind.purchase" },
];

function Caisse() {
  const t = useText();
  const qc = useQueryClient();
  const add = useServerFn(addExpense);
  const del = useServerFn(deleteExpense);
  const [kind, setKind] = useState<Kind>("entree");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  const { data, error, isPending } = useQuery({ queryKey: ["cash-book"], queryFn: () => getCashBook(), retry: false });

  if (error)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.denied")}</p>;
  if (isPending)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.loading")}</p>;

  const s = summarizeCash(data);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!label.trim() || !(value > 0)) {
      toast.error(t("cash.invalid"));
      return;
    }
    setBusy(true);
    try {
      await add({ data: { label, amount: value, spent_on: date, kind } });
      setLabel(""); setAmount(""); setDate(today());
      await qc.invalidateQueries({ queryKey: ["cash-book"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cash.invalid"));
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm(t("cash.confirmDelete"))) return;
    try { await del({ data: { id } }); await qc.invalidateQueries({ queryKey: ["cash-book"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("cash.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("cash.intro")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("cash.in")} value={brl(s.inTotal)} />
        <Stat label={t("cash.out")} value={brl(s.outTotal)} />
        <Stat label={t("cash.purchases")} value={brl(s.purchaseTotal)} />
        <Stat label={t("cash.net")} value={brl(s.net)} strong />
      </div>

      <form onSubmit={submit} className="mt-8 rounded-2xl border bg-card p-5">
        <fieldset className="border-0 p-0">
          <legend className="text-sm font-medium">{t("cash.kindLabel")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                  kind === k.value ? "border-primary bg-primary/10" : "border-input hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="cash-kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    kind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                  }`}
                >
                  {kind === k.value && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="font-medium">{t(k.key)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
          <Input placeholder={t("cash.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
          <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" disabled={busy}>{t("cash.add")}</Button>
        </div>
      </form>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <EntriesList title={t("cash.in")} empty={t("cash.emptyIn")} rows={data.entries} onDelete={remove} />
        <List title={t("cash.out")} empty={t("cash.emptyOut")} rows={data.expenses} sign="−" onDelete={remove} />
        <List title={t("cash.purchases")} empty={t("cash.emptyPurchases")} rows={data.purchases} sign="−" onDelete={remove} />
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? "bg-primary/10 border-primary/40" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function EntriesList({ title, empty, rows, onDelete }: { title: string; empty: string; rows: CashEntry[]; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">
                  {r.label}
                  {r.kind === "entree" && <span className="ml-2 text-xs text-muted-foreground">(manuel)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">+ {brl(r.amount)}</span>
                {r.kind === "entree" && (
                  <button type="button" aria-label="Supprimer" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function List({ title, empty, rows, sign, onDelete }: { title: string; empty: string; rows: CashEntry[]; sign: string; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{sign} {brl(r.amount)}</span>
                <button type="button" aria-label="Supprimer" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
