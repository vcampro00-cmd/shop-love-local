import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addExpense, deleteExpense, getCashBook } from "@/lib/cash.functions";
import { brl } from "@/lib/products";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/caisse")({
  head: () => ({
    meta: [
      { title: "Caisse — Vcampro" },
      { name: "description", content: "Entrées et sorties d'argent de la boutique Vcampro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Caisse — Vcampro" },
      { property: "og:description", content: "Entrées et sorties d'argent de la boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Caisse,
});

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

function Caisse() {
  const t = useText();
  const qc = useQueryClient();
  const add = useServerFn(addExpense);
  const del = useServerFn(deleteExpense);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  const { data, error, isPending } = useQuery({ queryKey: ["cash-book"], queryFn: () => getCashBook(), retry: false });

  if (error)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.denied")}</p>;
  if (isPending)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.loading")}</p>;

  const inSum = data.entries.reduce((s, e) => s + e.amount, 0);
  const outSum = data.expenses.reduce((s, e) => s + e.amount, 0);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!label.trim() || !(value > 0)) return toast.error(t("cash.invalid"));
    setBusy(true);
    try {
      await add({ data: { label, amount: value, spent_on: date } });
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("cash.in")} value={brl(inSum)} />
        <Stat label={t("cash.out")} value={brl(outSum)} />
        <Stat label={t("cash.balance")} value={brl(inSum - outSum)} strong />
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_140px_160px_auto]">
        <Input placeholder={t("cash.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
        <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" disabled={busy}>{t("cash.add")}</Button>
      </form>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <List title={t("cash.in")} empty={t("cash.emptyIn")} rows={data.entries} sign="+" />
        <List title={t("cash.out")} empty={t("cash.emptyOut")} rows={data.expenses} sign="−" onDelete={remove} />
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

function List({ title, empty, rows, sign, onDelete }: { title: string; empty: string; rows: { id: string; date: string; label: string; amount: number }[]; sign: string; onDelete?: (id: string) => void }) {
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
                {onDelete && (
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
