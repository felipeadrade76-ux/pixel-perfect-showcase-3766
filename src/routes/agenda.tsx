import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { atrasada, dataHora, useOrdens, type Ordem } from "@/lib/oficina-store";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Oficina Inteligente" },
      {
        name: "description",
        content: "Previsões de conclusão, máquinas prontas para retirada e serviços concluídos.",
      },
      { property: "og:title", content: "Agenda — Oficina Inteligente" },
      { property: "og:description", content: "Agenda automática da oficina, sem cadastro manual." },
    ],
  }),
  component: Agenda,
});

type Evento = { id: string; quando: string; titulo: string; ordem: Ordem; tom: string };

function Agenda() {
  const ordens = useOrdens();

  const eventos: Evento[] = [];
  for (const o of ordens) {
    if (o.prazo && o.status !== "Pronta" && o.status !== "Entregue") {
      eventos.push({
        id: o.id + "-prazo",
        quando: o.prazo,
        titulo: atrasada(o) ? "Previsão vencida" : "Previsão de conclusão",
        ordem: o,
        tom: atrasada(o) ? "text-destructive" : "text-primary",
      });
    }
    if (o.concluidaEm && o.status === "Pronta") {
      eventos.push({
        id: o.id + "-pronta",
        quando: o.concluidaEm,
        titulo: "Pronta para retirada",
        ordem: o,
        tom: "text-accent",
      });
    }
    if (o.entregueEm) {
      eventos.push({
        id: o.id + "-entrega",
        quando: o.entregueEm,
        titulo: "Máquina entregue",
        ordem: o,
        tom: "text-muted-foreground",
      });
    }
  }
  eventos.sort((a, b) => +new Date(a.quando) - +new Date(b.quando));

  return (
    <AppShell title="Agenda" subtitle="Gerada automaticamente pelas ordens">
      <div className="space-y-3">
        {eventos.map((e) => (
          <Link
            key={e.id}
            to="/ordem/$id"
            params={{ id: e.ordem.id }}
            className="block rounded-2xl border border-border bg-card p-4 active:bg-secondary"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-bold ${e.tom}`}>{e.titulo}</p>
                <p className="truncate text-base font-semibold text-foreground">
                  {e.ordem.cliente} · {e.ordem.tipoMaquina}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.ordem.numero} · {dataHora(e.quando)}
                </p>
              </div>
              <StatusBadge status={e.ordem.status} />
            </div>
          </Link>
        ))}
        {eventos.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhum compromisso na agenda.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
