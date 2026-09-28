import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { moeda, pago, saldo, total, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Ritmeia" }] }),
  component: Financeiro,
});
const mesDeData = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const mesAtual = () => mesDeData(new Date());
const mesDe = (iso: string) => mesDeData(new Date(iso));
const emOrcamento = (s: string) =>
  ["Recebida", "Em diagnóstico", "Aguardando aprovação"].includes(s);
const box =
  "rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5";
const campo = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base";

type Cobranca = Database["public"]["Tables"]["cobrancas"]["Row"];

function Financeiro() {
  const ordens = useOrdens();
  const [mes, setMes] = useState(mesAtual);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [avisos, setAvisos] = useState<Cobranca[]>([]);
  const [erroAvisos, setErroAvisos] = useState("");
  useEffect(() => {
    let ativo = true;
    let versao = 0;
    async function consultar() {
      const atual = ++versao;
      const pagina = 500;
      const todas: Cobranca[] = [];
      for (let inicio = 0; ; inicio += pagina) {
        const { data, error } = await supabase
          .from("cobrancas")
          .select("*")
          .in("status", ["aguardando", "informado"])
          .order("criada_em", { ascending: false })
          .order("id", { ascending: false })
          .range(inicio, inicio + pagina - 1);
        if (!ativo || atual !== versao) return;
        if (error || !data) {
          setErroAvisos("Não foi possível carregar os avisos de cobrança.");
          return;
        }
        todas.push(...data);
        if (data.length < pagina) break;
      }
      if (!ativo || atual !== versao) return;
      setErroAvisos("");
      setAvisos(todas);
    }
    void consultar();
    const aoFocar = () => void consultar();
    window.addEventListener("focus", aoFocar);
    return () => {
      ativo = false;
      window.removeEventListener("focus", aoFocar);
    };
  }, [ordens]);
  const info = useMemo(() => {
    const pagamentos = ordens.flatMap((o) =>
      o.pagamentos.filter((p) => mesDe(p.data) === mes).map((p) => ({ ...p, ordem: o })),
    );
    const recebido = pagamentos.reduce((a, p) => a + p.valor, 0);
    const ativos = ordens.filter((o) => !emOrcamento(o.status));
    const aberto = ativos.reduce((a, o) => a + Math.max(0, saldo(o)), 0);
    const orcamentos = ordens
      .filter((o) => emOrcamento(o.status))
      .reduce((a, o) => a + Math.max(0, total(o)), 0);
    const formas = ["Pix", "Dinheiro", "Cartão"].map((forma) => ({
      forma,
      valor: pagamentos.filter((p) => p.forma === forma).reduce((a, p) => a + p.valor, 0),
    }));
    const cobrancas = ativos.filter((o) => saldo(o) > 0);
    return { pagamentos, recebido, aberto, orcamentos, formas, cobrancas };
  }, [ordens, mes]);
  const visiveis = info.cobrancas.filter((o) => {
    if (
      ![o.cliente, o.numero, o.tipoMaquina, o.marca, o.modelo]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(busca.toLocaleLowerCase("pt-BR"))
    )
      return false;
    return filtro === "Todos" || (filtro === "Parcial" ? pago(o) > 0 : pago(o) === 0);
  });
  const cards = [
    ["Recebido no mês", info.recebido, "text-accent"],
    ["A receber", info.aberto, "text-destructive"],
    ["Orçamentos iniciais", info.orcamentos, "text-muted-foreground"],
    ["OS com saldo", info.cobrancas.length, "text-foreground"],
  ] as const;
  return (
    <AppShell title="Financeiro" subtitle="Controle mensal de recebimentos e saldos">
      <div className="space-y-5">
        <div className={box}>
          <label htmlFor="mes" className="mb-2 block text-sm font-semibold">
            Mês dos recebimentos
          </label>
          <input
            id="mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={campo + " max-w-xs"}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            O saldo a receber mostra a situação atual de todas as OS; os recebimentos seguem o mês
            selecionado.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([nome, valor, cor]) => (
            <div key={nome} className={box + " min-w-0"}>
              <p className="text-xs text-muted-foreground">{nome}</p>
              <p className={"mt-2 break-words text-xl font-bold sm:text-2xl " + cor}>
                {nome === "OS com saldo" ? valor : moeda(valor)}
              </p>
            </div>
          ))}
        </div>
        <section className={box}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Cobranças
          </p>
          <h2 className="mt-1 font-extrabold tracking-tight">Cobranças e avisos de pagamento</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aviso do cliente não comprova depósito. Valores só entram em “Recebido” após confirmação
            manual.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
              <p className="mt-1 font-bold">
                {moeda(
                  avisos
                    .filter((c) => c.status === "aguardando")
                    .reduce((v, c) => v + Number(c.valor), 0),
                )}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Cliente informou; conferir</p>
              <p className="mt-1 font-bold">
                {moeda(
                  avisos
                    .filter((c) => c.status === "informado")
                    .reduce((v, c) => v + Number(c.valor), 0),
                )}
              </p>
            </div>
          </div>
          {erroAvisos && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {erroAvisos}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {avisos.slice(0, 20).map((c) => {
              const ordem = ordens.find((o) => o.id === c.ordem_id);
              return (
                <Link
                  key={c.id}
                  to="/ordem/$id"
                  params={{ id: c.ordem_id }}
                  className="flex justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {ordem?.cliente ?? "Ordem de serviço"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ordem?.numero ?? "OS"} · {c.forma} ·{" "}
                      {c.status === "informado" ? "Cliente informou" : "Aguardando"}
                    </p>
                  </div>
                  <strong className="shrink-0 text-sm">{moeda(Number(c.valor))}</strong>
                </Link>
              );
            })}
            {!avisos.length && !erroAvisos && (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança em aberto.</p>
            )}
            {avisos.length > 20 && (
              <p className="text-xs text-muted-foreground">Exibindo os 20 avisos mais recentes.</p>
            )}
          </div>
        </section>
        <section className={box}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Resumo
          </p>
          <h2 className="mb-4 mt-1 font-extrabold tracking-tight">
            Recebido por forma de pagamento
          </h2>
          <div className="space-y-4">
            {info.formas.map((x) => (
              <div key={x.forma}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{x.forma}</span>
                  <strong>{moeda(x.valor)}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: (info.recebido ? (x.valor / info.recebido) * 100 : 0) + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={box}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Pendências
          </p>
          <h2 className="mb-3 mt-1 font-extrabold tracking-tight">
            Saldos em aberto ({info.cobrancas.length})
          </h2>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              aria-label="Buscar ordem ou cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, máquina ou OS..."
              className={campo}
            />
            <select
              aria-label="Filtrar pagamento"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className={campo}
            >
              <option>Todos</option>
              <option>Parcial</option>
              <option>Sem pagamento</option>
            </select>
          </div>
          <div className="space-y-2">
            {visiveis.slice(0, 30).map((o) => (
              <Link
                key={o.id}
                to="/ordem/$id"
                params={{ id: o.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 active:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{o.cliente}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.numero} · {o.tipoMaquina}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total {moeda(total(o))} · Pago {moeda(pago(o))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-destructive">{moeda(saldo(o))}</p>
                  <span className="text-xs text-muted-foreground">
                    {pago(o) > 0 ? "Parcial" : "Pendente"}
                  </span>
                </div>
              </Link>
            ))}
            {visiveis.length > 30 && (
              <p className="text-xs text-muted-foreground">
                Exibindo os 30 primeiros resultados. Refine a busca.
              </p>
            )}
            {!visiveis.length && (
              <p className="text-sm text-muted-foreground">Nenhum saldo encontrado.</p>
            )}
          </div>
        </section>
        <section className={box}>
          <h2 className="mb-3 font-bold">Últimos recebimentos no mês</h2>
          <div className="space-y-2">
            {[...info.pagamentos]
              .sort((a, b) => b.data.localeCompare(a.data))
              .slice(0, 20)
              .map((p) => (
                <Link
                  key={p.id}
                  to="/ordem/$id"
                  params={{ id: p.ordem.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.ordem.cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.ordem.numero} · {p.forma} · {new Date(p.data).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <strong className="shrink-0 text-accent">{moeda(p.valor)}</strong>
                </Link>
              ))}
            {!info.pagamentos.length && (
              <p className="text-sm text-muted-foreground">Nenhum recebimento neste mês.</p>
            )}
          </div>
        </section>
        <p className="text-xs text-muted-foreground">
          Resumo operacional, não contábil. Orçamentos sem aprovação não são contabilizados como
          valores a receber. A baixa de Pix continua manual.
        </p>
      </div>
    </AppShell>
  );
}
