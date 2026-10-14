import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import logo from "@/assets/vcampro-logo.png";
import { useCart } from "@/lib/cart";
import { useText } from "@/lib/content";

export function SiteHeader() {
  const { count } = useCart();
  const t = useText();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Vcampro" className="h-9 w-auto" />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link to="/" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>{t("nav.shop")}</Link>
          <Link to="/como-funciona" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>{t("nav.how")}</Link>
          <Link to="/carrinho" className="relative flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-primary-foreground shadow-glow">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.cart")}</span>
            <span className="rounded-full bg-background/30 px-2 text-xs">{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useText();
  return (
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <p>{t("footer.line1")}</p>
      <p className="mt-2">{t("footer.line2")}</p>
      <p className="mt-4">
        <Link to="/editar" className="text-xs underline decoration-dotted underline-offset-4 hover:text-foreground">Espace propriétaire</Link>
      </p>
    </footer>
  );
}
