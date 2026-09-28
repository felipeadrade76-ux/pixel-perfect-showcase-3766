import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  AlertTriangle,
  Wrench,
  Search,
  PackageCheck,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { atrasada, carregarExemplos, dataCurta, useOrdens } from "@/lib/oficina-store";

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
    {
      label: "Serviços atrasados",
      n: atrasadas.length,
      icon: AlertTriangle,
      cor: "text-destructive",
    },
  ];

  const ativas = ordens.filter((o) => o.status !== "Entregue");

  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell title="Painel da oficina" subtitle="Sua operação em um só lugar">
      <section className="mb-5 overflow-hidden rounded-[26px] bg-primary px-5 py-6 text-primary-foreground shadow-[0_18px_45px_rgba(17,29,43,0.12)] sm:px-7 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
            Visão geral
          </span>
          <span className="text-xs font-medium capitalize text-white/65">{data}</span>
        </div>
        <h2 className="mt-5 max-w-lg text-[27px] font-extrabold leading-tight tracking-tight sm:text-3xl">
          Tudo em ordem na sua oficina.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">
          Acompanhe as máquinas, os prazos e as próximas entregas sem perder o controle.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/nova"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-extrabold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" /> Nova entrada
          </Link>
          <Link
            to="/ordens"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/15"
          >
            Ver ordens <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo da oficina">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(17,29,43,0.025)] sm:p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <c.icon className={`h-5 w-5 ${c.cor}`} />
            </span>
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">{c.n}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground sm:text-sm">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Acompanhamento
          </p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">
            Máquinas na oficina
          </h2>
        </div>
        <Link
          to="/ordens"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-bold text-accent hover:bg-secondary"
        >
          Ver todas <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="space-y-3">
        {ativas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-7 text-sm text-muted-foreground">
            <ClipboardList className="mb-3 h-9 w-9 text-muted-foreground/60" />
            <p className="font-semibold">Nenhuma máquina na oficina no momento.</p>
            <p className="mt-1 text-xs">
              Cadastre a primeira ordem para começar a acompanhar os serviços.
            </p>
            {ordens.length === 0 ? (
              <button
                onClick={carregarExemplos}
                className="mt-3 rounded-lg border border-input px-4 py-2 font-medium text-foreground"
              >
                Carregar ordens de exemplo
              </button>
            ) : null}
          </div>
        ) : null}
        {ativas.map((o) => (
          <Link
            key={o.id}
            to="/ordem/$id"
            params={{ id: o.id }}
            className="group block rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(17,29,43,0.025)] transition-colors hover:border-accent/40 hover:bg-secondary/30 active:bg-secondary sm:p-5"
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
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {o.problema}
            </p>
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
