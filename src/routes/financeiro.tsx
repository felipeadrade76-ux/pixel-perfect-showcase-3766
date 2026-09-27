import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { moeda, pago, saldo, total, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — OficinIA" }] }),
  component: Financeiro,
});
const mesAtual = () => new Date().toLocaleDateString("en-CA", {year:"numeric",month:"2-digit"}).slice(0,7);
const mesDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA",{year:"numeric",month:"2-digit"}).slice(0,7);
const emOrcamento = (s: string) => ["Recebida","Em diagnóstico","Aguardando aprovação"].includes(s);
const box = "rounded-2xl border border-border bg-card p-4";
const campo = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base";

function Financeiro() {
  const ordens = useOrdens();
  const [mes,setMes] = useState(mesAtual);
  const [busca,setBusca] = useState("");
  const [filtro,setFiltro] = useState("Todos");
  const info = useMemo(() => {
    const pagamentos = ordens.flatMap(o => o.pagamentos.filter(p => mesDe(p.data) === mes).map(p => ({...p,ordem:o})));
    const recebido = pagamentos.reduce((a,p) => a+p.valor,0);
    const ativos = ordens.filter(o => !emOrcamento(o.status) && o.status !== "Cancelada");
    const aberto = ativos.reduce((a,o) => a+Math.max(0,saldo(o)),0);
    const orcamentos = ordens.filter(o => emOrcamento(o.status)).reduce((a,o) => a+Math.max(0,total(o)),0);
    const formas = ["Pix","Dinheiro","Cartão"].map(forma => ({forma,valor:pagamentos.filter(p => p.forma===forma).reduce((a,p)=>a+p.valor,0)}));
    const cobrancas = ativos.filter(o => saldo(o)>0);
    return {pagamentos,recebido,aberto,orcamentos,formas,cobrancas};
  },[ordens,mes]);
  const visiveis = info.cobrancas.filter(o => {
    if (![o.cliente,o.numero,o.tipoMaquina,o.marca,o.modelo].join(" ").toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))) return false;
    return filtro==="Todos" || (filtro==="Parcial" ? pago(o)>0 : pago(o)===0);
  });
  const cards = [
    ["Recebido no mês",info.recebido,"text-accent"],
    ["A receber",info.aberto,"text-destructive"],
    ["Orçamentos iniciais",info.orcamentos,"text-muted-foreground"],
    ["OS com saldo",info.cobrancas.length,"text-foreground"],
  ] as const;
  return <AppShell title="Financeiro" subtitle="Controle mensal de recebimentos e saldos">
    <div className="space-y-5">
      <div className={box}>
        <label htmlFor="mes" className="mb-2 block text-sm font-semibold">Mês dos recebimentos</label>
        <input id="mes" type="month" value={mes} onChange={e=>setMes(e.target.value)} className={campo+" max-w-xs"}/>
        <p className="mt-2 text-xs text-muted-foreground">O saldo a receber mostra a situação atual de todas as OS; os recebimentos seguem o mês selecionado.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">{cards.map(([nome,valor,cor])=><div key={nome} className={box+" min-w-0"}>
        <p className="text-xs text-muted-foreground">{nome}</p>
        <p className={"mt-2 break-words text-xl font-bold sm:text-2xl "+cor}>{nome==="OS com saldo"?valor:moeda(valor)}</p>
      </div>)}</div>
      <section className={box}>
        <h2 className="mb-4 font-bold">Recebido por forma de pagamento</h2>
        <div className="space-y-4">{info.formas.map(x=><div key={x.forma}>
          <div className="mb-2 flex justify-between text-sm"><span>{x.forma}</span><strong>{moeda(x.valor)}</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{width:(info.recebido ? x.valor/info.recebido*100:0)+"%"}}/></div>
        </div>)}</div>
      </section>
      <section className={box}>
        <h2 className="mb-3 font-bold">Saldos em aberto ({info.cobrancas.length})</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input aria-label="Buscar ordem ou cliente" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente, máquina ou OS..." className={campo}/>
          <select aria-label="Filtrar pagamento" value={filtro} onChange={e=>setFiltro(e.target.value)} className={campo}><option>Todos</option><option>Parcial</option><option>Sem pagamento</option></select>
        </div>
        <div className="space-y-2">{visiveis.slice(0,30).map(o=><Link key={o.id} to="/ordem/$id" params={{id:o.id}} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 active:bg-secondary">
          <div className="min-w-0"><p className="truncate font-bold">{o.cliente}</p><p className="truncate text-xs text-muted-foreground">{o.numero} · {o.tipoMaquina}</p><p className="text-xs text-muted-foreground">Total {moeda(total(o))} · Pago {moeda(pago(o))}</p></div>
          <div className="text-right"><p className="font-bold text-destructive">{moeda(saldo(o))}</p><span className="text-xs text-muted-foreground">{pago(o)>0?"Parcial":"Pendente"}</span></div>
        </Link>)}
        {visiveis.length>30&&<p className="text-xs text-muted-foreground">Exibindo os 30 primeiros resultados. Refine a busca.</p>}
        {!visiveis.length&&<p className="text-sm text-muted-foreground">Nenhum saldo encontrado.</p>}</div>
      </section>
      <section className={box}><h2 className="mb-3 font-bold">Últimos recebimentos no mês</h2><div className="space-y-2">
        {[...info.pagamentos].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,20).map(p=><Link key={p.id} to="/ordem/$id" params={{id:p.ordem.id}} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.ordem.cliente}</p><p className="text-xs text-muted-foreground">{p.ordem.numero} · {p.forma} · {new Date(p.data).toLocaleDateString("pt-BR")}</p></div><strong className="shrink-0 text-accent">{moeda(p.valor)}</strong>
        </Link>)}
        {!info.pagamentos.length&&<p className="text-sm text-muted-foreground">Nenhum recebimento neste mês.</p>}</div>
      </section>
      <p className="text-xs text-muted-foreground">Resumo operacional, não contábil. Orçamentos sem aprovação não são contabilizados como valores a receber. A baixa de Pix continua manual.</p>
    </div>
  </AppShell>;
}
