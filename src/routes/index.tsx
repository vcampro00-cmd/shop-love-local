import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Truck, CreditCard } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { products, brl, APP_PLAN_LABEL } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vcampro — Boutique en ligne" },
      { name: "description", content: "Achetez chez Vcampro, payez en ligne et faites-vous livrer à votre adresse." },
      { property: "og:title", content: "Vcampro — Boutique en ligne" },
      { property: "og:description", content: "Payez en ligne et recevez votre commande à votre adresse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { add } = useCart();
  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={hero} alt="iPhone SE 2020 et Redmi Note 11S" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-6xl">
            Achetez en ligne chez <span className="text-brand">Vcampro</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">Payez sur le site et recevez votre commande à votre adresse.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg" className="bg-brand shadow-glow"><a href="#produtos">Voir les téléphones</a></Button>
            <Button asChild size="lg" variant="outline"><Link to="/como-funciona">Comment ça marche</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3">
        {[
          { i: CreditCard, t: "Paiement en ligne", d: "Sécurisé, directement sur le site." },
          { i: Truck, t: "Livraison", d: "Reçue à votre adresse." },
        ].map(({ i: I, t, d }) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <I className="h-5 w-5 text-accent" />
            <div><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
          </div>
        ))}
      </section>

      <section id="produtos" className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <h2 className="mb-6 text-2xl font-bold">Téléphones</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {products.map((p) => (
            <article key={p.id} className="flex flex-col rounded-3xl border bg-card p-6 transition hover:border-primary">
              <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{p.tag}</span>
              <div className="mt-4 flex flex-1 items-center gap-4">
                <img src={p.image} alt={p.name} loading="lazy" width={700} height={1000} className="h-32 w-24 shrink-0 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.65)]" />
                <div>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-xl font-bold">{brl(p.price)}</span>
                <Button size="sm" onClick={() => { add(p.id); toast.success(`${p.name} ajouté au panier`); }}>
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 rounded-2xl border bg-secondary p-4 text-sm text-muted-foreground">Remarque : {APP_PLAN_LABEL}.</p>
      </section>
    </div>
  );
}
