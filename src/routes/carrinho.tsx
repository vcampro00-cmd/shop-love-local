import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus, Truck, Store } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getProduct, brl, orderTotal, DELIVERY_FEE } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho e pagamento — Vcampro" },
      { name: "description", content: "Revise seu carrinho, escolha entrega ou retirada e finalize o pagamento." },
      { property: "og:title", content: "Carrinho — Vcampro" },
      { property: "og:description", content: "Finalize sua compra na Vcampro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cart,
});

const base = { name: z.string().trim().min(2, "Informe seu nome").max(100), phone: z.string().trim().min(8, "Telefone inválido").max(20) };
const deliverySchema = z.object({ ...base, address: z.string().trim().min(8, "Informe o endereço completo").max(300), cep: z.string().trim().min(8, "CEP inválido").max(9) });
const pickupSchema = z.object(base);

function Cart() {
  const { lines, setQty, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [method, setMethod] = useState<"entrega" | "retirada">("entrega");
  const [form, setForm] = useState({ name: "", phone: "", address: "", cep: "", notes: "" });
  const total = orderTotal(subtotal, method);

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Seu carrinho está vazio</h1>
        <Button asChild className="mt-6 bg-brand"><Link to="/">Ver produtos</Link></Button>
      </div>
    );

  function pay(e: React.FormEvent) {
    e.preventDefault();
    const r = (method === "entrega" ? deliverySchema : pickupSchema).safeParse(form);
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    const id = "VC" + Date.now().toString().slice(-6);
    clear();
    navigate({ to: "/pedido/$id", params: { id }, search: { m: method, t: total } });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={pay} className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section>
          <h1 className="mb-4 text-3xl font-bold">Carrinho</h1>
          <div className="divide-y rounded-2xl border bg-card">
            {lines.map((l) => {
              const p = getProduct(l.id);
              if (!p) return null;
              return (
                <div key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{brl(p.price)}</p></div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty - 1)} aria-label="Diminuir"><Minus className="h-4 w-4" /></Button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty + 1)} aria-label="Aumentar"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">Como quer receber?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["entrega", Truck, "Entrega no endereço", `Taxa de ${brl(DELIVERY_FEE)}`], ["retirada", Store, "Retirar no local", "Grátis"]] as const).map(([v, I, t, d]) => (
              <button type="button" key={v} onClick={() => setMethod(v)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${method === v ? "border-primary bg-secondary shadow-glow" : "bg-card"}`}>
                <I className="h-5 w-5 text-accent" /><div><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <div><Label>Nome</Label><Input value={form.name} onChange={set("name")} maxLength={100} /></div>
          <div><Label>Telefone</Label><Input value={form.phone} onChange={set("phone")} maxLength={20} /></div>
          {method === "entrega" && (
            <>
              <div className="sm:col-span-2"><Label>Endereço (rua, número, bairro, cidade)</Label><Input value={form.address} onChange={set("address")} maxLength={300} /></div>
              <div><Label>CEP</Label><Input value={form.cep} onChange={set("cep")} maxLength={9} /></div>
            </>
          )}
          <div className="sm:col-span-2"><Label>Observações do pedido</Label><Textarea value={form.notes} onChange={set("notes")} maxLength={500} placeholder="Ex.: cor preferida, ponto de referência..." /></div>
        </section>
      </div>

      <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Resumo</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          <div className="flex justify-between"><span>{method === "entrega" ? "Entrega" : "Retirada"}</span><span>{method === "entrega" ? brl(DELIVERY_FEE) : "Grátis"}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{brl(total)}</span></div>
        </div>
        <Button type="submit" size="lg" className="mt-6 w-full bg-brand shadow-glow">Pagar {brl(total)}</Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Modo de demonstração — nenhum valor é cobrado ainda.</p>
      </aside>
    </form>
  );
}
