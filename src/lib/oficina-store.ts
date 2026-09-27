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
let carregando = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function erro(e: unknown) {
  console.error("Falha ao salvar na nuvem", e);
}

export async function loadOrdens() {
  if (typeof window === "undefined" || carregando) return;
  carregando = true;
  const { data, error } = await supabase
    .from("ordens")
    .select("*")
    .order("criada_em", { ascending: false });
  carregando = false;
  if (error) return erro(error);
  state = (data as Row[]).map(fromRow);
  emit();
}

export function limparOrdens() {
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

function salvar(o: Ordem) {
  const { id, ...rest } = toRow(o);
  supabase
    .from("ordens")
    .update(rest)
    .eq("id", id)
    .then(({ error }) => error && erro(error));
}

function update(id: string, fn: (o: Ordem) => Ordem) {
  let changed: Ordem | undefined;
  state = state.map((o) => (o.id === id ? (changed = fn(o)) : o));
  emit();
  if (changed) salvar(changed);
}

export function proximoNumero() {
  const nums = state.map((o) => Number(o.numero.replace(/\D/g, "")) || 0);
  return "OS-" + String(Math.max(0, ...nums) + 1).padStart(4, "0");
}

export function criarOrdem(
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
): Ordem {
  const agora = new Date().toISOString();
  const nova: Ordem = {
    ...dados,
    id: uid(),
    numero: proximoNumero(),
    status: "Recebida",
    criadaEm: agora,
    historico: [{ data: agora, texto: "Ordem criada" }],
    itens: [],
    pagamentos: [],
  };
  state = [nova, ...state];
  emit();
  supabase
    .from("ordens")
    .insert(toRow(nova))
    .then(({ error }) => error && erro(error));
  return nova;
}

export function alterarStatus(id: string, status: Status) {
  const agora = new Date().toISOString();
  update(id, (o) => {
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

export function editarOrdem(id: string, dados: Partial<Ordem>) {
  const agora = new Date().toISOString();
  update(id, (o) => ({
    ...o,
    ...dados,
    historico: [...o.historico, { data: agora, texto: "Dados da ordem atualizados" }],
  }));
}

export function adicionarItem(id: string, item: Omit<Item, "id">) {
  const agora = new Date().toISOString();
  update(id, (o) => ({
    ...o,
    itens: [...o.itens, { ...item, id: uid() }],
    historico: [
      ...o.historico,
      { data: agora, texto: `${item.tipo} adicionada: ${item.descricao}` },
    ],
  }));
}

export function removerItem(id: string, itemId: string) {
  update(id, (o) => ({ ...o, itens: o.itens.filter((i) => i.id !== itemId) }));
}

const pagamentosEmAndamento = new Set<string>();

/** Confirma o lançamento no Supabase antes de exibir o pagamento como recebido.
 * Bloqueia cliques simultâneos neste navegador; integração bancária não está implementada.
 * Ainda requer uma operação transacional no banco para múltiplos dispositivos concorrentes.
 */
export async function registrarPagamento(
  id: string,
  valor: number,
  forma: Pagamento["forma"],
): Promise<void> {
  if (!Number.isFinite(valor) || valor <= 0 || !["Pix", "Dinheiro", "Cartão"].includes(forma)) {
    throw new Error("Informe um valor positivo e uma forma de pagamento válida.");
  }
  if (pagamentosEmAndamento.has(id)) {
    throw new Error("Aguarde o lançamento anterior terminar.");
  }
  pagamentosEmAndamento.add(id);
  try {
    const { data, error } = await supabase.from("ordens").select("*").eq("id", id).single();
    if (error || !data) throw new Error("Não foi possível consultar o saldo atualizado. Tente novamente.");
    const atual = fromRow(data as Row);
    const pendente = saldo(atual);
    const arredondado = Math.round(valor * 100) / 100;
    if (arredondado <= 0 || arredondado > Math.round(pendente * 100) / 100) {
      throw new Error("O valor informado ultrapassa o saldo disponível ou é inválido.");
    }
    const agora = new Date().toISOString();
    const alterada: Ordem = {
      ...atual,
      pagamentos: [...atual.pagamentos, { id: uid(), valor: arredondado, forma, data: agora }],
      historico: [...atual.historico, { data: agora, texto: `Pagamento de ${moeda(arredondado)} registrado manualmente via ${forma}` }],
    };
    const { id: rowId, ...resto } = toRow(alterada);
    const { data: salva, error: erroSalvar } = await supabase
      .from("ordens").update(resto).eq("id", rowId).select("*").single();
    if (erroSalvar || !salva) throw new Error("O pagamento não foi confirmado no banco. Confira a conexão e tente novamente.");
    state = state.map((o) => o.id === id ? fromRow(salva as Row) : o);
    emit();
  } finally {
    pagamentosEmAndamento.delete(id);
  }
}

export function excluirOrdem(id: string) {
  state = state.filter((o) => o.id !== id);
  emit();
  supabase
    .from("ordens")
    .delete()
    .eq("id", id)
    .then(({ error }) => error && erro(error));
}

const dias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

/** Cria ordens fictícias de exemplo para quem está começando (ação do usuário). */
export function carregarExemplos() {
  const ex: Parameters<typeof criarOrdem>[0][] = [
    { cliente: "João Pereira", telefone: "(31) 98888-1122", tipoMaquina: "Motosserra", marca: "Stihl", modelo: "MS 170", problema: "Não pega a frio e perde força no corte.", prazo: dias(2) },
    { cliente: "Maria Santos", telefone: "(31) 97777-4455", tipoMaquina: "Roçadeira", marca: "Husqvarna", modelo: "143R", problema: "Vazamento de combustível no tanque.", prazo: dias(3) },
    { cliente: "Sítio Boa Vista", tipoMaquina: "Gerador", marca: "Toyama", problema: "Gerador liga mas não gera energia.", prazo: dias(-1) },
    { cliente: "Carlos Dias", telefone: "(31) 96666-7788", tipoMaquina: "Cortador de grama", marca: "Tramontina", problema: "Lâmina desbalanceada, muita vibração.", prazo: dias(0) },
  ];
  ex.forEach((d) => criarOrdem(d));
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
