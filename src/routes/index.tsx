import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Truck, CreditCard, Store } from "lucide-react";
import logo from "@/assets/vcampro-logo.png";
import { brl } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
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
  const t = useText();
  const { list: products } = useCatalog();

  const cards = [
    { i: CreditCard, t: t("home.card1Title"), d: t("home.card1Text") },
    { i: Truck, t: t("home.card2Title"), d: t("home.card2Text") },
    { i: Store, t: t("home.card3Title"), d: t("home.card3Text") },
  ];

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 md:opacity-30">
          <img src={logo} alt="Vcampro" className="max-h-[60%] w-auto max-w-[70%] object-contain md:max-w-[40%]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-6xl">
            {t("home.heroTitleA")} <span className="text-brand">{t("home.heroTitleB")}</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">{t("home.heroSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-brand shadow-glow"><a href="#produtos">{t("home.ctaPrimary")}</a></Button>
            <Button asChild size="lg" variant="outline"><Link to="/como-funciona">{t("home.ctaSecondary")}</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3">
        {cards.map(({ i: I, t: title, d }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <I className="h-5 w-5 text-accent" />
            <div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{d}</p></div>
          </div>
        ))}
      </section>

      <section id="produtos" className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <h2 className="mb-6 text-2xl font-bold">{t("home.productsTitle")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {products.map((p) => {
            const name = p.name;
            const price = p.price;
            return (
              <article key={p.id} className="flex flex-col rounded-3xl border bg-card p-6 transition hover:border-primary">
                <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{p.tag}</span>
                <div className="mt-4 flex flex-1 items-center gap-4">
                  <img src={p.image} alt={name} loading="lazy" width={p.imageW} height={p.imageH} className="h-32 w-auto shrink-0 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.65)]" />
                  <div>
                    <h3 className="text-lg font-bold">{name}</h3>
                    {p.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xl font-bold">{brl(price)}</span>
                  <Button size="sm" onClick={() => { add(p.id); toast.success(`${name} ajouté au panier`); }}>
                    <Plus className="h-4 w-4" /> Ajouter
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 rounded-2xl border bg-secondary p-4 text-sm text-muted-foreground">Remarque : {t("home.planNote")}.</p>
      </section>
    </div>
  );
}
