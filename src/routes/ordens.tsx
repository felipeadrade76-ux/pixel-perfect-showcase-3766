import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, ClipboardList, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUSES, atrasada, dataCurta, moeda, saldo, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/ordens")({
  head: () => ({
    meta: [
      { title: "Ordens de serviço — Oficina Inteligente" },
      {
        name: "description",
        content: "Pesquise, acompanhe e altere o status das ordens de serviço da oficina.",
      },
      { property: "og:title", content: "Ordens de serviço — Oficina Inteligente" },
      { property: "og:description", content: "Lista completa das ordens de serviço da oficina." },
    ],
  }),
  component: Ordens,
});

function Ordens() {
  const ordens = useOrdens();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("Todas");

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return ordens.filter((o) => {
      const okFiltro = filtro === "Todas" || o.status === filtro;
      const okBusca =
        !b ||
        [o.cliente, o.numero, o.tipoMaquina, o.marca, o.modelo, o.problema]
          .join(" ")
          .toLowerCase()
          .includes(b);
      return okFiltro && okBusca;
    });
  }, [ordens, busca, filtro]);

  return (
    <AppShell title="Ordens de serviço" subtitle={`${lista.length} ordem(ns) listada(s)`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-accent">
            Controle de serviços
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
            {lista.length} {lista.length === 1 ? "ordem encontrada" : "ordens encontradas"}
          </h2>
        </div>
        <Link
          to="/nova"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-extrabold text-accent-foreground sm:px-4 sm:text-sm"
        >
          <Plus className="h-4 w-4" /> Nova OS
        </Link>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente, máquina ou nº da OS"
          aria-label="Buscar ordens de serviço"
          className="w-full min-h-12 rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base outline-none focus:border-accent"
        />
      </div>

      <div
        aria-label="Filtrar ordens por status"
        className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {["Todas", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            aria-pressed={filtro === s}
            className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filtro === s
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {lista.map((o) => (
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
                  {o.numero} · {o.tipoMaquina}
                  {o.modelo ? ` ${o.modelo}` : ""}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
              <span>Entrada {dataCurta(o.criadaEm)}</span>
              {o.prazo ? (
                <span className={atrasada(o) ? "text-destructive" : ""}>
                  Previsão {dataCurta(o.prazo)}
                </span>
              ) : null}
              <ChevronRight
                aria-hidden="true"
                className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-accent"
              />
              {saldo(o) > 0 ? (
                <span className="text-destructive">Saldo {moeda(saldo(o))}</span>
              ) : null}
            </div>
          </Link>
        ))}
        {lista.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <span className="block font-semibold">Nenhuma ordem encontrada.</span>
            <span className="mt-1 block text-xs">
              Experimente outro filtro ou cadastre uma nova ordem.
            </span>
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
