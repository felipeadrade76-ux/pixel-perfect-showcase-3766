import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, AlertTriangle, Wrench, Search, PackageCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { atrasada, dataCurta, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oficina Inteligente — Painel da oficina" },
      {
        name: "description",
        content:
          "Painel com máquinas em manutenção, aguardando diagnóstico, prontas para retirada e serviços atrasados.",
      },
      { property: "og:title", content: "Oficina Inteligente — Painel da oficina" },
      {
        property: "og:description",
        content: "Controle de ordens de serviço para oficina de máquinas.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const ordens = useOrdens();

  const emManutencao = ordens.filter((o) => o.status === "Em manutenção");
  const diagnostico = ordens.filter(
    (o) => o.status === "Recebida" || o.status === "Em diagnóstico",
  );
  const prontas = ordens.filter((o) => o.status === "Pronta");
  const atrasadas = ordens.filter(atrasada);

  const cards = [
    { label: "Em manutenção", n: emManutencao.length, icon: Wrench, cor: "text-primary" },
    { label: "Aguardando diagnóstico", n: diagnostico.length, icon: Search, cor: "text-primary" },
    { label: "Prontas p/ retirada", n: prontas.length, icon: PackageCheck, cor: "text-accent" },
    { label: "Serviços atrasados", n: atrasadas.length, icon: AlertTriangle, cor: "text-destructive" },
  ];

  const ativas = ordens.filter((o) => o.status !== "Entregue");

  return (
    <AppShell title="Oficina Inteligente" subtitle="Painel de hoje">
      <Link
        to="/nova"
        className="mb-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-4 py-5 text-lg font-bold text-accent-foreground shadow-sm active:opacity-90"
      >
        <Plus className="h-7 w-7" /> Nova entrada
      </Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <c.icon className={`h-6 w-6 ${c.cor}`} />
            <p className="mt-2 text-3xl font-bold text-foreground">{c.n}</p>
            <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-base font-bold text-foreground">Máquinas na oficina</h2>
      <div className="space-y-3">
        {ativas.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhuma máquina na oficina no momento.
          </p>
        ) : null}
        {ativas.map((o) => (
          <Link
            key={o.id}
            to="/ordem/$id"
            params={{ id: o.id }}
            className="block rounded-2xl border border-border bg-card p-4 active:bg-secondary"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">{o.cliente}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {o.tipoMaquina}
                  {o.marca ? ` · ${o.marca}` : ""} · {o.numero}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.problema}</p>
            {o.prazo ? (
              <p
                className={`mt-2 text-xs font-semibold ${atrasada(o) ? "text-destructive" : "text-muted-foreground"}`}
              >
                {atrasada(o) ? "Atrasada desde " : "Previsão: "}
                {dataCurta(o.prazo)}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
