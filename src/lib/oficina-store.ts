import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STATUSES = [
  "Recebida",
  "Em diagnóstico",
  "Aguardando aprovação",
  "Aguardando peças",
  "Em manutenção",
  "Pronta",
  "Entregue",
] as const;

export type Status = (typeof STATUSES)[number];

export type Pagamento = {
  id: string;
  valor: number;
  forma: "Pix" | "Dinheiro" | "Cartão";
  data: string;
};

export type Item = {
  id: string;
  descricao: string;
  tipo: "Peça" | "Mão de obra";
  valor: number;
};

export type Evento = {
  data: string;
  texto: string;
};

export type Ordem = {
  id: string;
  numero: string;
  revisao: number;
  cliente: string;
  telefone?: string | undefined;
  tipoMaquina: string;
  marca?: string | undefined;
  modelo?: string | undefined;
  serie?: string | undefined;
  problema: string;
  observacoes?: string | undefined;
  prazo?: string | undefined;
  status: Status;
  criadaEm: string;
  concluidaEm?: string | undefined;
  entregueEm?: string | undefined;
  historico: Evento[];
  itens: Item[];
  pagamentos: Pagamento[];
};

const uid = () => crypto.randomUUID();

type Row = {
  id: string;
  numero: string;
  revisao: number;
  cliente: string;
  telefone: string | null;
  tipo_maquina: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  problema: string;
  observacoes: string | null;
  prazo: string | null;
  status: string;
  criada_em: string;
  concluida_em: string | null;
  entregue_em: string | null;
  historico: unknown;
  itens: unknown;
  pagamentos: unknown;
};

const u = (v: string | null) => v ?? undefined;

function fromRow(r: Row): Ordem {
  return {
    id: r.id,
    numero: r.numero,
    revisao: r.revisao,
    cliente: r.cliente,
    telefone: u(r.telefone),
    tipoMaquina: r.tipo_maquina,
    marca: u(r.marca),
    modelo: u(r.modelo),
    serie: u(r.serie),
    problema: r.problema,
    observacoes: u(r.observacoes),
    prazo: u(r.prazo),
    status: r.status as Status,
    criadaEm: r.criada_em,
    concluidaEm: u(r.concluida_em),
    entregueEm: u(r.entregue_em),
    historico: (r.historico as Evento[]) ?? [],
    itens: (r.itens as Item[]) ?? [],
    pagamentos: (r.pagamentos as Pagamento[]) ?? [],
  };
}

function toRow(o: Ordem) {
  return {
    id: o.id,
    numero: o.numero,
    cliente: o.cliente,
    telefone: o.telefone || null,
    tipo_maquina: o.tipoMaquina,
    marca: o.marca || null,
    modelo: o.modelo || null,
    serie: o.serie || null,
    problema: o.problema,
    observacoes: o.observacoes || null,
    prazo: o.prazo || null,
    status: o.status,
    criada_em: o.criadaEm,
    concluida_em: o.concluidaEm || null,
    entregue_em: o.entregueEm || null,
    historico: o.historico,
    itens: o.itens,
    pagamentos: o.pagamentos,
  };
}

let state: Ordem[] = [];
let carregamentoVersao = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function loadOrdens(): Promise<void> {
  if (typeof window === "undefined") return;
  const versao = ++carregamentoVersao;
  const { data, error } = await supabase
    .from("ordens")
    .select("*")
    .order("criada_em", { ascending: false });
  if (versao !== carregamentoVersao) return; // Ignore a previous user's stale response.
  if (error || !data)
    throw new Error("Falha ao carregar ordens. Confira a internet e tente novamente.");
  state = (data as Row[]).map(fromRow);
  emit();
}

export function limparOrdens() {
  ++carregamentoVersao;
  state = [];
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => state;
const EMPTY: Ordem[] = [];
const getServerSnapshot = () => EMPTY;

export function useOrdens() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useOrdem(id: string) {
  return useOrdens().find((o) => o.id === id);
}

const alteracoesEmAndamento = new Set<string>();

async function update(id: string, fn: (o: Ordem) => Ordem): Promise<void> {
  if (alteracoesEmAndamento.has(id)) {
    throw new Error("Aguarde a alteração anterior terminar.");
  }
  alteracoesEmAndamento.add(id);
  try {
    const { data, error } = await supabase.from("ordens").select("*").eq("id", id).single();
    if (error || !data) throw new Error("Não foi possível consultar a ordem. Confira a conexão.");
    const atual = fromRow(data as Row);
    const alterada = fn(atual);
    // Only mutable nonfinancial fields; never overwrite payments during a concurrent edit.
    const { data: salva, error: erroSalvar } = await supabase
      .from("ordens")
      .update({
        cliente: alterada.cliente,
        telefone: alterada.telefone ?? null,
        tipo_maquina: alterada.tipoMaquina,
        marca: alterada.marca ?? null,
        modelo: alterada.modelo ?? null,
        serie: alterada.serie ?? null,
        problema: alterada.problema,
        observacoes: alterada.observacoes ?? null,
        prazo: alterada.prazo ?? null,
        status: alterada.status,
        concluida_em: alterada.concluidaEm ?? null,
        entregue_em: alterada.entregueEm ?? null,
        historico: alterada.historico,
        itens: alterada.itens,
      })
      .eq("id", id)
      .eq("revisao", atual.revisao)
      .select("*")
      .maybeSingle();
    if (erroSalvar || !salva) {
      throw new Error(
        "A ordem foi alterada em outro dispositivo ou a gravação falhou. Atualize a tela e confira os dados.",
      );
    }
    state = state.map((o) => (o.id === id ? fromRow(salva as Row) : o));
    emit();
  } finally {
    alteracoesEmAndamento.delete(id);
  }
}

export function proximoNumero() {
  const nums = state.map((o) => Number(o.numero.replace(/\D/g, "")) || 0);
  return "OS-" + String(Math.max(0, ...nums) + 1).padStart(4, "0");
}

export async function criarOrdem(
  dados: Pick<
    Ordem,
    | "cliente"
    | "telefone"
    | "tipoMaquina"
    | "marca"
    | "modelo"
    | "serie"
    | "problema"
    | "observacoes"
    | "prazo"
  >,
  requisicaoId: string = uid(),
): Promise<Ordem> {
  const agora = new Date().toISOString();
  const nova: Ordem = {
    ...dados,
    id: requisicaoId,
    numero: "",
    revisao: 0,
    status: "Recebida",
    criadaEm: agora,
    historico: [{ data: agora, texto: "Ordem criada" }],
    itens: [],
    pagamentos: [],
  };
  const { numero: _numeroIgnorado, ...semNumero } = toRow(nova);
  const { data, error } = await supabase.from("ordens").insert(semNumero).select("*").single();
  let salva = data;
  if (error && error.code === "23505") {
    // Retry with the same ID after a lost response: find the previously saved OS.
    const repetida = await supabase.from("ordens").select("*").eq("id", requisicaoId).maybeSingle();
    if (!repetida.error && repetida.data) salva = repetida.data;
  }
  if (!salva) {
    throw new Error(
      "Não foi possível confirmar a criação. Confira a lista de OS antes de tentar novamente.",
    );
  }
  const confirmada = fromRow(salva as Row);
  state = [confirmada, ...state.filter((o) => o.id !== confirmada.id)];
  emit();
  return confirmada;
}

export async function alterarStatus(id: string, status: Status) {
  const agora = new Date().toISOString();
  await update(id, (o) => {
    const hist = [...o.historico];
    if (status === "Pronta") {
      hist.push({ data: agora, texto: "Serviço concluído — máquina pronta para retirada" });
    } else {
      hist.push({ data: agora, texto: `Status alterado para ${status}` });
    }
    return {
      ...o,
      status,
      concluidaEm: status === "Pronta" ? agora : o.concluidaEm,
      entregueEm: status === "Entregue" ? agora : o.entregueEm,
      historico: hist,
    };
  });
}

export async function editarOrdem(id: string, dados: Partial<Ordem>) {
  const agora = new Date().toISOString();
  await update(id, (o) => ({
    ...o,
    ...dados,
    historico: [...o.historico, { data: agora, texto: "Dados da ordem atualizados" }],
  }));
}

export async function adicionarItem(id: string, item: Omit<Item, "id">) {
  const agora = new Date().toISOString();
  await update(id, (o) => ({
    ...o,
    itens: [...o.itens, { ...item, id: uid() }],
    historico: [
      ...o.historico,
      { data: agora, texto: `${item.tipo} adicionada: ${item.descricao}` },
    ],
  }));
}

export async function removerItem(id: string, itemId: string) {
  await update(id, (o) => ({ ...o, itens: o.itens.filter((i) => i.id !== itemId) }));
}

const pagamentosEmAndamento = new Set<string>();
const requisicoesPagamento = new Map<
  string,
  { id: string; valor: number; forma: Pagamento["forma"] }
>();

/** The RPC locks the OS row, validates its balance in the database and deduplicates by request UUID. */
export async function registrarPagamento(
  id: string,
  valor: number,
  forma: Pagamento["forma"],
): Promise<void> {
  if (
    !Number.isFinite(valor) ||
    valor <= 0 ||
    Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-7 ||
    !["Pix", "Dinheiro", "Cartão"].includes(forma)
  ) {
    throw new Error("Informe um valor positivo com até duas casas decimais e uma forma válida.");
  }
  if (pagamentosEmAndamento.has(id) || alteracoesEmAndamento.has(id)) {
    throw new Error("Aguarde a operação anterior terminar.");
  }
  const anterior = requisicoesPagamento.get(id);
  const pagamentoId =
    anterior && anterior.valor === valor && anterior.forma === forma ? anterior.id : uid();
  requisicoesPagamento.set(id, { id: pagamentoId, valor, forma });
  pagamentosEmAndamento.add(id);
  try {
    const { data, error } = await supabase.rpc("oficinia_registrar_pagamento", {
      p_ordem: id,
      p_pagamento_id: pagamentoId,
      p_valor: valor,
      p_forma: forma,
    });
    if (error || !data) {
      throw new Error(
        "Não foi possível confirmar o lançamento. Confira a OS antes de tentar novamente.",
      );
    }
    const confirmada = fromRow(data as Row);
    state = state.map((o) => (o.id === id ? confirmada : o));
    emit();
    requisicoesPagamento.delete(id);
  } finally {
    pagamentosEmAndamento.delete(id);
  }
}

export async function excluirOrdem(id: string): Promise<void> {
  if (alteracoesEmAndamento.has(id) || pagamentosEmAndamento.has(id)) {
    throw new Error("Aguarde a operação anterior terminar.");
  }
  alteracoesEmAndamento.add(id);
  try {
    const { data, error } = await supabase.from("ordens").delete().eq("id", id).select("id");
    if (error || !data || data.length !== 1) {
      throw new Error("A exclusão não foi confirmada no banco. Tente novamente.");
    }
    state = state.filter((o) => o.id !== id);
    emit();
  } finally {
    alteracoesEmAndamento.delete(id);
  }
}

const dias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

/** Cria ordens fictícias de exemplo para quem está começando (ação do usuário). */
export function carregarExemplos() {
  const ex: Parameters<typeof criarOrdem>[0][] = [
    {
      cliente: "João Pereira",
      telefone: "(31) 98888-1122",
      tipoMaquina: "Motosserra",
      marca: "Stihl",
      modelo: "MS 170",
      problema: "Não pega a frio e perde força no corte.",
      prazo: dias(2),
    },
    {
      cliente: "Maria Santos",
      telefone: "(31) 97777-4455",
      tipoMaquina: "Roçadeira",
      marca: "Husqvarna",
      modelo: "143R",
      problema: "Vazamento de combustível no tanque.",
      prazo: dias(3),
    },
    {
      cliente: "Sítio Boa Vista",
      tipoMaquina: "Gerador",
      marca: "Toyama",
      problema: "Gerador liga mas não gera energia.",
      prazo: dias(-1),
    },
    {
      cliente: "Carlos Dias",
      telefone: "(31) 96666-7788",
      tipoMaquina: "Cortador de grama",
      marca: "Tramontina",
      problema: "Lâmina desbalanceada, muita vibração.",
      prazo: dias(0),
    },
  ];
  void Promise.allSettled(ex.map((d) => criarOrdem(d))).then((resultados) => {
    const falhas = resultados.filter((r) => r.status === "rejected");
    if (falhas.length) console.error("Falha ao criar ordens de exemplo", falhas);
  });
}

export const total = (o: Ordem) => o.itens.reduce((s, i) => s + i.valor, 0);
export const pago = (o: Ordem) => o.pagamentos.reduce((s, p) => s + p.valor, 0);
export const saldo = (o: Ordem) => total(o) - pago(o);

export const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const dataCurta = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

export const atrasada = (o: Ordem) =>
  !!o.prazo &&
  new Date(o.prazo).getTime() < Date.now() &&
  o.status !== "Pronta" &&
  o.status !== "Entregue";
