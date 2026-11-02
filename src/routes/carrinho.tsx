import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { useText, numFromText } from "@/lib/content";
import { useX } from "@/lib/lang";
import { canPayInTwoTimes, splitPayment, type PaymentPlan, type DeliveryMethod } from "@/lib/pricing";
import { useAccount, rememberIntendedPath } from "@/lib/auth";
import { createOrder, checkSplitCode } from "@/lib/orders.functions";
import { checkPromo } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PHONE_COUNTRIES, countryOf, nationalDigits, formatPhone, isCompletePhone } from "@/lib/phone";

export const Route = createFileRoute("/carrinho")({
  staticData: { sitemap: false },
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

function Cart() {
  const { lines, setQty, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const t = useText();
  const x = useX();
  const catalog = useCatalog();
  const { user, loading } = useAccount();
  const placeOrder = useServerFn(createOrder);
  const [form, setForm] = useState({ name: "", phone: "", address: "", cep: "" });
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState("FR");
  const pc = countryOf(country);
  const phoneDigits = nationalDigits(pc, form.phone);
  const [plan, setPlan] = useState<PaymentPlan>("full");
  const [method, setMethod] = useState<DeliveryMethod>("livraison");
  // Espèces = uniquement avec le retrait sur place.
  const [payMethod, setPayMethod] = useState<"carte" | "especes">("carte");
  const cash = payMethod === "especes";
  const verifyPromo = useServerFn(checkPromo);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; amount: number } | null>(null);

  const schema = z
    .object({
      name: z.string().trim().min(2, x("Indiquez votre nom", "Informe seu nome")).max(100),
      phone: z.string().trim().min(8, x("Téléphone invalide", "Telefone inválido")).max(20),
      address: z.string().trim().max(300),
      cep: z.string().trim().max(9),
      method: z.enum(["livraison", "retrait"]),
    })
    .superRefine((v, ctx) => {
      if (v.method !== "livraison") return;
      if (v.address.length < 8) ctx.addIssue({ code: "custom", path: ["address"], message: x("Indiquez l'adresse complète", "Informe o endereço completo") });
      if (v.cep.length < 4) ctx.addIssue({ code: "custom", path: ["cep"], message: x("Code postal invalide", "Código postal inválido") });
    });

  const fee = numFromText(t("delivery.fee"), 0);
  const shipping = subtotal > 0 && method === "livraison" ? fee : 0;
  const discount = promo ? Math.min(promo.amount, subtotal + shipping) : 0;
  const total = subtotal + shipping - discount;
  const parts = splitPayment(total, "split");
  // Le 2 fois s'ouvre seulement avec le code donné par le propriétaire, et jamais pour un téléphone « une seule fois ».
  const verifySplit = useServerFn(checkSplitCode);
  const [splitInput, setSplitInput] = useState("");
  const [splitCode, setSplitCode] = useState<string | null>(null);
  const twoTimesAllowed = Boolean(splitCode) && canPayInTwoTimes(lines.map((l) => ({ id: l.id, qty: l.qty })), catalog.fullOnlyIds);
  const effectivePlan: PaymentPlan = twoTimesAllowed ? plan : "full";

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
    if (!isCompletePhone(pc, phoneDigits)) {
      toast.error(x("Téléphone invalide", "Telefone inválido"));
      return;
    }
    const fullPhone = formatPhone(pc, phoneDigits);
    const r = schema.safeParse({ ...form, phone: fullPhone, method });
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? x("Vérifiez vos informations", "Confira suas informações"));
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder({
        data: {
          name: form.name,
          phone: fullPhone,
          address: form.address,
          postal_code: form.cep,
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
          plan: cash ? "full" : effectivePlan,
          delivery_method: cash ? "retrait" : method,
          payment_method: payMethod,
          promo_code: promo?.code,
          split_code: effectivePlan === "split" ? splitCode ?? undefined : undefined,
        },
      });
      clear();
      if (cash) {
        toast.success(t("pay.cashPlaced"));
        navigate({ to: "/pedido/$id", params: { id: order.id } });
      } else navigate({ to: "/paiement/$id", params: { id: order.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : x("Commande impossible. Réessayez.", "Não foi possível pedir. Tente novamente."));
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
              const p = catalog.get(l.id);
              if (!p) return null;
              const name = p.name;
              const price = p.price;
              return (
                <div key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={name} loading="lazy" width={p.imageW} height={p.imageH} className="h-20 w-auto shrink-0 object-contain" />
                    <div><p className="font-medium">{name}</p><p className="text-sm text-muted-foreground">{brl(price)}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty - 1)} aria-label={x("Diminuer", "Diminuir")}><Minus className="h-4 w-4" /></Button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <Button type="button" size="icon" variant="outline" onClick={() => setQty(l.id, l.qty + 1)} aria-label={x("Augmenter", "Aumentar")}><Plus className="h-4 w-4" /></Button>
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
            <h2 className="text-xl font-bold sm:col-span-2">{t("delivery.methodTitle")}</h2>
            <div className="grid gap-2 text-sm sm:col-span-2">
              {(["livraison", "retrait"] as const).filter((m) => !cash || m === "retrait").map((m) => (
                <label key={m} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${method === m ? "border-primary bg-primary/10" : ""}`}>
                  <input type="radio" name="method" className="mt-1" checked={method === m} onChange={() => setMethod(m)} />
                  <span>
                    <span className="block font-medium">
                      {m === "livraison" ? `${t("delivery.shipping")} — ${brl(fee)}` : t("delivery.pickup")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {m === "livraison" ? t("delivery.shippingHint") : t("delivery.pickupHint")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div><Label>{t("form.name")}</Label><Input value={form.name} onChange={set("name")} maxLength={100} /></div>
            <div>
              <Label>{t("form.phone")}</Label>
              <div className="flex gap-2">
                <select
                  aria-label={t("form.country")}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-9 shrink-0 rounded-md border bg-background px-2 text-sm"
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} +{c.dial}</option>
                  ))}
                </select>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={formatPhone(pc, phoneDigits)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(new RegExp(`^\\s*\\+?${pc.dial}`), "");
                    setForm({ ...form, phone: nationalDigits(pc, raw) });
                  }}
                />
              </div>
            </div>
            {method === "livraison" && (
              <>
                <div className="sm:col-span-2"><Label>{t("form.address")}</Label><Input value={form.address} onChange={set("address")} maxLength={300} /></div>
                <div><Label>{t("form.cep")}</Label><Input value={form.cep} onChange={set("cep")} maxLength={9} /></div>
              </>
            )}
          </section>
        )}
      </div>

      <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">{t("cart.summary")}</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>{t("cart.subtotal")}</span><span>{brl(subtotal)}</span></div>
          <div className="flex justify-between"><span>{t("delivery.label")}</span><span>{method === "retrait" ? t("delivery.pickup") : brl(shipping)}</span></div>
          {discount > 0 && <div className="flex justify-between text-accent"><span>{t("cart.promoLine")} ({promo?.code})</span><span>−{brl(discount)}</span></div>}
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>{t("cart.total")}</span><span>{brl(total)}</span></div>
        </div>

        {user && (
          <div className="mt-5 flex gap-2">
            <Input placeholder={t("cart.promoLabel")} value={promoInput} onChange={(e) => setPromoInput(e.target.value)} maxLength={30} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!promoInput.trim()) { setPromo(null); return; }
                try {
                  const r = await verifyPromo({ data: { code: promoInput } });
                  if (r.valid) { setPromo(r); toast.success(r.amount > 0 ? `${r.code} : −${brl(r.amount)}` : `${r.code} ✓`); }
                  else { setPromo(null); toast.error(x("Code promo invalide", "Código promocional inválido")); }
                } catch { toast.error(x("Code promo invalide", "Código promocional inválido")); }
              }}
            >
              {t("cart.promoApply")}
            </Button>
          </div>
        )}

        {user && (
          <fieldset className="mt-5 space-y-2 text-sm">
            <legend className="mb-2 font-bold">{t("pay.choose")}</legend>
            {!splitCode && (
              <div className="mb-2 flex gap-2">
                <Input placeholder={t("cart.splitCodeLabel")} value={splitInput} onChange={(e) => setSplitInput(e.target.value)} maxLength={30} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!splitInput.trim()) return;
                    try {
                      const r = await verifySplit({ data: { code: splitInput } });
                      if (!r.valid) { toast.error(t("cart.splitCodeInvalid")); return; }
                      if (!canPayInTwoTimes(lines.map((l) => ({ id: l.id, qty: l.qty })), catalog.fullOnlyIds)) { toast.error(t("cart.splitCodeFullOnly")); return; }
                      setSplitCode(splitInput.trim().toUpperCase()); setPlan("split"); setPayMethod("carte");
                      toast.success(t("cart.splitCodeOk"));
                    } catch { toast.error(t("cart.splitCodeInvalid")); }
                  }}
                >
                  {t("cart.promoApply")}
                </Button>
              </div>
            )}
            {(["full", "split"] as const).filter((p) => p !== "split" || twoTimesAllowed).map((p) => (
              <label key={p} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${!cash && plan === p ? "border-primary bg-primary/10" : ""}`}>
                <input type="radio" name="plan" className="mt-1" checked={!cash && plan === p} onChange={() => { setPlan(p); setPayMethod("carte"); }} />
                <span>
                  <span className="block font-medium">{p === "full" ? `${t("pay.full")} — ${brl(total)}` : `${t("pay.split")} — 2 × ${brl(parts.now)}`}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p === "full" ? t("pay.fullHint") : `${brl(parts.now)} ${t("pay.splitNow")}, ${brl(parts.later)} ${t("pay.splitLater")}`}
                  </span>
                </span>
              </label>
            ))}
            {plan === "split" && !cash && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-xs font-bold">{t("cart.splitContractTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed">{t("cart.splitContract")}</p>
              </div>
            )}
          </fieldset>
        )}

        {loading ? (
          <Button size="lg" disabled className="mt-6 w-full bg-brand">{t("cart.pay")}</Button>
        ) : user ? (
          <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full bg-brand shadow-glow">{cash ? `${t("pay.cashOrder")} — ${brl(total)}` : `${t("cart.pay")} ${brl(effectivePlan === "full" ? total : parts.now)}`}</Button>
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
