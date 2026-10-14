import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_FEE, brl } from "@/lib/products";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona o pedido — Vcampro" },
      { name: "description", content: "Passo a passo para comprar na Vcampro: carrinho, pagamento, entrega ou retirada." },
      { property: "og:title", content: "Como funciona o pedido — Vcampro" },
      { property: "og:description", content: "Entenda como fazer seu pedido na Vcampro." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  { t: "Escolha os produtos", d: "Adicione ao carrinho os produtos que deseja e ajuste as quantidades." },
  { t: "Entrega ou retirada", d: `Escolha receber no seu endereço (taxa de ${brl(DELIVERY_FEE)}) ou retirar gratuitamente no local.` },
  { t: "Preencha seus dados", d: "Informe nome, telefone e, para entrega, o endereço completo." },
  { t: "Pague pelo site", d: "Finalize o pagamento online com segurança." },
  { t: "Acompanhe o pedido", d: "Você recebe o número do pedido. Avisamos quando estiver pronto para retirada ou a caminho." },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold">Como funciona o <span className="text-brand">pedido</span></h1>
      <p className="mt-3 text-muted-foreground">Comprar na Vcampro é simples. Veja o passo a passo:</p>
      <ol className="mt-10 space-y-4">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-4 rounded-2xl border bg-card p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-primary-foreground">{i + 1}</span>
            <div><h2 className="font-bold">{s.t}</h2><p className="text-sm text-muted-foreground">{s.d}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-10 rounded-2xl border bg-secondary p-5 text-sm">
        <p className="font-bold">Retirada no local</p>
        <p className="mt-1 text-muted-foreground">Leve o número do pedido e um documento com foto. O endereço e horário de retirada aparecem na confirmação.</p>
      </div>
    </div>
  );
}
