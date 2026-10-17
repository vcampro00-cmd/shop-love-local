import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addPromo, deletePromo, getInventory, setStock } from "@/lib/inventory.functions";
import { getProduct, brl } from "@/lib/products";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { title: "Stock et codes promo — Vcampro" },
      { name: "description", content: "Gestion du stock de téléphones et des codes promo Vcampro." },
      { property: "og:title", content: "Stock — Vcampro" },
      { property: "og:description", content: "Espace propriétaire Vcampro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const t = useText();
  const qc = useQueryClient();
  const fetchInv = useServerFn(getInventory);
  const save = useServerFn(setStock);
  const add = useServerFn(addPromo);
  const del = useServerFn(deletePromo);
  const { data, error } = useQuery({ queryKey: ["inventory"], queryFn: () => fetchInv() });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["inventory"] });
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); toast.success("OK"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  if (error) return <p className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">{t("admin.denied")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <section>
        <h1 className="text-3xl font-bold">{t("stock.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("stock.intro")}</p>
        <div className="mt-6 divide-y rounded-2xl border bg-card">
          {(data?.stock ?? []).map((s) => {
            const p = getProduct(s.id);
            const val = edits[s.id] ?? String(s.quantity);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  {p && <img src={p.image} alt="" width={p.imageW} height={p.imageH} className="h-14 w-auto object-contain" />}
                  <div>
                    <p className="font-medium">{t(`product.${s.id}.name`)}</p>
                    <p className={`text-sm ${s.quantity === 0 ? "text-destructive" : "text-muted-foreground"}`}>{s.quantity} en stock</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} className="w-24" value={val} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                  <Button size="sm" className="bg-brand" onClick={() => run(() => save({ data: { id: s.id as never, quantity: Math.max(0, parseInt(val, 10) || 0) } }))}>
                    {t("stock.save")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{t("stock.promoTitle")}</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const a = parseFloat(amount.replace(",", "."));
            if (!code.trim() || !(a > 0)) return toast.error("Code et montant obligatoires");
            run(async () => { await add({ data: { code, amount: a } }); setCode(""); setAmount(""); });
          }}
        >
          <div><label className="text-sm">{t("stock.promoCode")}</label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VCAMPRO20" maxLength={30} /></div>
          <div><label className="text-sm">{t("stock.promoAmount")}</label><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" className="w-28" inputMode="decimal" /></div>
          <Button type="submit" className="bg-brand">{t("stock.promoAdd")}</Button>
        </form>
        <ul className="mt-4 divide-y rounded-2xl border bg-card">
          {(data?.promos ?? []).map((p) => (
            <li key={p.code} className="flex items-center justify-between p-4">
              <span className="font-medium">{p.code} — −{brl(p.amount)}</span>
              <Button size="icon" variant="outline" aria-label="Supprimer" onClick={() => run(() => del({ data: { code: p.code } }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
