import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente, máquina ou nº da OS"
          className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {["Todas", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
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
            className="block rounded-2xl border border-border bg-card p-4 active:bg-secondary"
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
            <div className="mt-2 flex flex-wrap gap-x-4 text-xs font-semibold text-muted-foreground">
              <span>Entrada {dataCurta(o.criadaEm)}</span>
              {o.prazo ? (
                <span className={atrasada(o) ? "text-destructive" : ""}>
                  Previsão {dataCurta(o.prazo)}
                </span>
              ) : null}
              {saldo(o) > 0 ? <span className="text-destructive">Saldo {moeda(saldo(o))}</span> : null}
            </div>
          </Link>
        ))}
        {lista.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhuma ordem encontrada.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
