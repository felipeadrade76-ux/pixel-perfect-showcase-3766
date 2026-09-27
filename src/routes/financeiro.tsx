import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { moeda, pago, saldo, total, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Oficina Inteligente" },
      {
        name: "description",
        content: "Totais de peças e mão de obra, pagamentos recebidos e saldos pendentes.",
      },
      { property: "og:title", content: "Financeiro — Oficina Inteligente" },
      { property: "og:description", content: "Controle financeiro simples da oficina." },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const ordens = useOrdens();
  const bruto = ordens.reduce((s, o) => s + total(o), 0);
  const recebido = ordens.reduce((s, o) => s + pago(o), 0);
  const pendente = bruto - recebido;
  const devedores = ordens.filter((o) => saldo(o) > 0);

  const cards = [
    { l: "Total dos serviços", v: bruto, c: "text-foreground" },
    { l: "Recebido", v: recebido, c: "text-accent" },
    { l: "Pendente", v: pendente, c: "text-destructive" },
  ];

  return (
    <AppShell title="Financeiro" subtitle="Confirmação manual dos pagamentos">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.l} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{c.l}</p>
            <p className={`mt-1 text-2xl font-bold ${c.c}`}>{moeda(c.v)}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-base font-bold text-foreground">Saldos em aberto</h2>
      <div className="space-y-3">
        {devedores.map((o) => (
          <Link
            key={o.id}
            to="/ordem/$id"
            params={{ id: o.id }}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4 active:bg-secondary"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">{o.cliente}</p>
              <p className="truncate text-sm text-muted-foreground">
                {o.numero} · {o.tipoMaquina} · total {moeda(total(o))}
              </p>
            </div>
            <span className="shrink-0 font-bold text-destructive">{moeda(saldo(o))}</span>
          </Link>
        ))}
        {devedores.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhum saldo pendente.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
