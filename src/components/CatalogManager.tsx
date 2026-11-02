import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { removeProduct, saveProduct } from "@/lib/catalog.functions";
import { useCatalog, shrinkImage, type ShopProduct } from "@/lib/catalog";
import { useText } from "@/lib/content";
import { brl } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Form = { id?: string; name: string; tag: string; description: string; descriptionPt: string; price: string; commission: string; fullOnly: boolean; image: string | null; preview: string };
const empty: Form = { name: "", tag: "", description: "", descriptionPt: "", price: "", commission: "", fullOnly: false, image: null, preview: "" };
const num = (v: string) => parseFloat(v.replace(",", "."));

export function CatalogManager() {
  const t = useText();
  const qc = useQueryClient();
  const { list } = useCatalog();
  const save = useServerFn(saveProduct);
  const remove = useServerFn(removeProduct);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["catalog"] }), qc.invalidateQueries({ queryKey: ["inventory"] })]);

  const edit = (p: ShopProduct) =>
    setForm({ id: p.id, name: p.name, tag: p.tag, description: p.description, descriptionPt: p.descriptionPt, price: String(p.price), commission: String(p.commission), fullOnly: p.fullPaymentOnly, image: null, preview: p.image });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const price = num(form.price);
    const commission = num(form.commission || "0");
    if (form.name.trim().length < 2 || !(price >= 0) || !(commission >= 0)) { toast.error("Nom et prix obligatoires"); return; }
    setBusy(true);
    try {
      await save({ data: { id: form.id, name: form.name, tag: form.tag, description: form.description, descriptionPt: form.descriptionPt, price, commission, fullPaymentOnly: form.fullOnly, image: form.image } });
      await refresh();
      setForm(null);
      toast.success("OK");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setBusy(false); }
  }

  async function onRemove(id: string) {
    if (!confirm(t("catalog.confirmRemove"))) return;
    try { await remove({ data: { id } }); await refresh(); toast.success("OK"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("catalog.title")}</h1>
        {!form && <Button className="bg-brand" onClick={() => setForm({ ...empty })}><Plus className="h-4 w-4" /> {t("catalog.add")}</Button>}
      </div>
      <p className="mt-2 text-muted-foreground">{t("catalog.intro")}</p>

      {form && (
        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <div><label className="text-sm">{t("catalog.name")}</label><Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-sm">{t("catalog.tag")}</label><Input value={form.tag} maxLength={40} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm">{t("catalog.description")}</label><Textarea value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm">{t("catalog.descriptionPt")}</label><Textarea value={form.descriptionPt} maxLength={1000} onChange={(e) => setForm({ ...form, descriptionPt: e.target.value })} /></div>
          <div><label className="text-sm">{t("catalog.price")}</label><Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div><label className="text-sm">{t("catalog.commission")}</label><Input inputMode="decimal" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.fullOnly} onChange={(e) => setForm({ ...form, fullOnly: e.target.checked })} />
            {t("catalog.fullOnly")}
          </label>
          <div className="sm:col-span-2">
            <label className="text-sm">{t("catalog.photo")}</label>
            <div className="mt-1 flex items-center gap-3">
              {form.preview && <img src={form.preview} alt="" className="h-20 w-auto object-contain" />}
              <Input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { const img = await shrinkImage(f); setForm((cur) => cur && { ...cur, image: img, preview: img }); }
                catch { toast.error("Photo illisible"); }
              }} />
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" className="bg-brand" disabled={busy}>{t("catalog.save")}</Button>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>Annuler</Button>
          </div>
        </form>
      )}

      <ul className="mt-6 divide-y rounded-2xl border bg-card">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              {p.image && <img src={p.image} alt="" width={p.imageW} height={p.imageH} className="h-14 w-auto object-contain" />}
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{brl(p.price)} · commission {brl(p.commission)}{p.fullPaymentOnly ? " · 1×" : ""}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" aria-label={t("catalog.edit")} onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" aria-label={t("catalog.remove")} onClick={() => onRemove(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
