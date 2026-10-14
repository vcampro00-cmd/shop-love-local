import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getProduct } from "./products";

export type CartLine = { id: string; qty: number };

type Ctx = {
  lines: CartLine[];
  add: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "vcampro-cart";

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((s, l) => s + (getProduct(l.id)?.price ?? 0) * l.qty, 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = (id: string) =>
    setLines((ls) =>
      ls.some((l) => l.id === id)
        ? ls.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { id, qty: 1 }],
    );
  const setQty = (id: string, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty } : l))));

  return (
    <CartContext.Provider
      value={{
        lines,
        add,
        setQty,
        clear: () => setLines([]),
        count: lines.reduce((s, l) => s + l.qty, 0),
        subtotal: cartSubtotal(lines),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
