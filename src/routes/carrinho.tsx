import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getProduct, brl } from "@/lib/products";
import { useText, numFromText } from "@/lib/content";
import { useAccount, rememberIntendedPath } from "@/lib/auth";
import { createOrder } from "@/lib/orders.functions";
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
  const t = useText();
  const { user, loading } = useAccount();
  const placeOrder = useServerFn(createOrder);
  const [form, setForm] = useState({ name: "", phone: "", address: "", cep: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const fee = numFromText(t("delivery.fee"), 0);
  const total = subtotal + (subtotal > 0 ? fee : 0);

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">{t("cart.empty")}</h1>
        <Button asChild className="mt-6 bg-brand"><Link to="/">{t("cart.emptyCta")}</Link></Button>
      </div>
    );

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      rememberIntendedPath("/carrinho");
      navigate({ to: "/auth" });
      return;
    }
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? "Vérifiez vos informations");
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder({
        data: {
          name: form.name,
          phone: form.phone,
          address: form.address,
          postal_code: form.cep,
          notes: form.notes.trim() || undefined,
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        },
      });
      clear();
      navigate({ to: "/pedido/$id", params: { id: order.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Commande impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={pay} className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section>
          <h1 className="mb-4 text-3xl font-bold">{t("cart.title")}</h1>
          <div className="divide-y rounded-2xl border bg-card">
            {lines.map((l) => {
              const p = getProduct(l.id);
              if (!p) return null;
              const name = t(`product.${p.id}.name`);
              const price = numFromText(t(`product.${p.id}.price`), 0);
              return (
                <div key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={name} loading="lazy" width={p.imageW} height={p.imageH} className="h-20 w-auto shrink-0 object-contain" />
                    <div><p className="font-medium">{name}</p><p className="text-sm text-muted-foreground">{brl(price)}</p></div>
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

        {!loading && !user && (
          <section className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="text-xl font-bold">{t("auth.needAccountTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.needAccountText")}</p>
            <Button
              size="lg"
              className="mt-5 bg-brand shadow-glow"
              onClick={() => { rememberIntendedPath("/carrinho"); navigate({ to: "/auth" }); }}
            >
              {t("auth.needAccountCta")}
            </Button>
          </section>
        )}

        {!loading && user && (
          <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
            <h2 className="text-xl font-bold sm:col-span-2">{t("cart.addressTitle")}</h2>
            <div><Label>{t("form.name")}</Label><Input value={form.name} onChange={set("name")} maxLength={100} /></div>
            <div><Label>{t("form.phone")}</Label><Input value={form.phone} onChange={set("phone")} maxLength={20} /></div>
            <div className="sm:col-span-2"><Label>{t("form.address")}</Label><Input value={form.address} onChange={set("address")} maxLength={300} /></div>
            <div><Label>{t("form.cep")}</Label><Input value={form.cep} onChange={set("cep")} maxLength={9} /></div>
            <div className="sm:col-span-2"><Label>{t("form.notes")}</Label><Textarea value={form.notes} onChange={set("notes")} maxLength={500} placeholder={t("form.notesPlaceholder")} /></div>
          </section>
        )}
      </div>

      <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">{t("cart.summary")}</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>{brl(subtotal)}</span></div>
          <div className="flex justify-between"><span>{t("delivery.label")}</span><span>{brl(fee)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>{t("cart.total")}</span><span>{brl(total)}</span></div>
        </div>

        {loading ? (
          <Button size="lg" disabled className="mt-6 w-full bg-brand">{t("cart.pay")}</Button>
        ) : user ? (
          <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full bg-brand shadow-glow">{t("cart.pay")} {brl(total)}</Button>
        ) : (
          <Button
            size="lg"
            className="mt-6 w-full bg-brand shadow-glow"
            onClick={() => { rememberIntendedPath("/carrinho"); navigate({ to: "/auth" }); }}
          >
            {t("auth.needAccountCta")}
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">{t("cart.demoNote")}</p>
      </aside>
    </form>
  );
}
