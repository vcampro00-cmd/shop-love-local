export type Product = { id: string; name: string; description: string; price: number; tag: string };

// Produtos de exemplo — substituir pelos produtos reais da Vcampro.
export const products: Product[] = [
  { id: "cam-360", name: "Câmera Wi‑Fi 360°", description: "Visão noturna, áudio bidirecional e app no celular.", price: 249.9, tag: "Segurança" },
  { id: "fone-pro", name: "Fone Bluetooth Pro", description: "Cancelamento de ruído e 30h de bateria.", price: 399.0, tag: "Áudio" },
  { id: "relogio-fit", name: "Relógio Fit", description: "Monitor cardíaco, GPS e resistente à água.", price: 329.9, tag: "Wearables" },
  { id: "cam-ext", name: "Câmera Externa Full HD", description: "À prova d'água, sensor de movimento.", price: 289.0, tag: "Segurança" },
  { id: "caixa-som", name: "Caixa de Som Portátil", description: "Som 360° com graves potentes.", price: 199.9, tag: "Áudio" },
  { id: "carregador", name: "Carregador Turbo 65W", description: "Carrega celular e notebook rapidamente.", price: 129.9, tag: "Acessórios" },
];

export const DELIVERY_FEE = 15;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function orderTotal(subtotal: number, method: "entrega" | "retirada") {
  return subtotal + (method === "entrega" && subtotal > 0 ? DELIVERY_FEE : 0);
}
