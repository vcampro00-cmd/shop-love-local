import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getProduct, brl, orderTotal, DELIVERY_FEE } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Panier et paiement — Vcampro" },
      { name: "description", content: "Vérifiez votre panier, indiquez votre adresse de livraison et payez en ligne." },
      { property: "og:title", content: "Panier — Vcampro" },
      { property: "og:description", content: "Finalisez votre achat chez Vcampro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cart,
});

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  phone: z.string().trim().min(8, "Téléphone invalide").max(20),
  address: z.string().trim().min(8, "Indiquez l'adresse complète").max(300),
  cep: z.string().trim().min(4, "Code postal invalide").max(9),
});

function Cart() {
  const { lines, setQty, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", address: "", cep: "", notes: "" });
  const total = orderTotal(subtotal);

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Votre panier est vide</h1>
        <Button asChild className="mt-6 bg-brand"><Link to="/">Voir les téléphones</Link></Button>
      </div>
    );

  function pay(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? "Vérifiez vos informations");
      return;
    }
    const id = "VC" + Date.now().toString().slice(-6);
    clear();
    navigate({ to: "/pedido/$id", params: { id }, search: { t: total } });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={pay} className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section>
          <h1 className="mb-4 text-3xl font-bold">Panier</h1>
          <div className="divide-y rounded-2xl border bg-card">
            {lines.map((l) => {
              const p = getProduct(l.id);
              if (!p) return null;
              return (
                <div key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={p.name} loading="lazy" width={p.imageW} height={p.imageH} className="h-20 w-auto shrink-0 object-contain" />
                    <div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{brl(p.price)}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty - 1)} aria-label="Diminuer"><Minus className="h-4 w-4" /></Button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty + 1)} aria-label="Augmenter"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-xl font-bold sm:col-span-2">Adresse de livraison</h2>
          <div><Label>Nom</Label><Input value={form.name} onChange={set("name")} maxLength={100} /></div>
          <div><Label>Téléphone</Label><Input value={form.phone} onChange={set("phone")} maxLength={20} /></div>
          <div className="sm:col-span-2"><Label>Adresse (rue, numéro, ville)</Label><Input value={form.address} onChange={set("address")} maxLength={300} /></div>
          <div><Label>Code postal</Label><Input value={form.cep} onChange={set("cep")} maxLength={9} /></div>
          <div className="sm:col-span-2"><Label>Remarques sur la commande</Label><Textarea value={form.notes} onChange={set("notes")} maxLength={500} placeholder="Ex. : couleur préférée, code d'accès..." /></div>
        </section>
      </div>

      <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Récapitulatif</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Sous-total</span><span>{brl(subtotal)}</span></div>
          <div className="flex justify-between"><span>Livraison</span><span>{brl(DELIVERY_FEE)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{brl(total)}</span></div>
        </div>
        <Button type="submit" size="lg" className="mt-6 w-full bg-brand shadow-glow">Payer {brl(total)}</Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Mode démonstration — aucun montant n'est encore débité.</p>
      </aside>
    </form>
  );
}
