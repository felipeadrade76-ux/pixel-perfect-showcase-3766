import { useSyncExternalStore } from "react";

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

const KEY = "oficina-inteligente-v1";

const uid = () => Math.random().toString(36).slice(2, 10);

const dias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

function demo(): Ordem[] {
  return [
    {
      id: uid(),
      numero: "OS-0001",
      cliente: "João Pereira",
      telefone: "(31) 98888-1122",
      tipoMaquina: "Motosserra",
      marca: "Stihl",
      modelo: "MS 170",
      problema: "Não pega a frio e perde força no corte.",
      status: "Em manutenção",
      prazo: dias(2),
      criadaEm: dias(-4),
      historico: [
        { data: dias(-4), texto: "Ordem criada" },
        { data: dias(-3), texto: "Status alterado para Em diagnóstico" },
        { data: dias(-1), texto: "Status alterado para Em manutenção" },
      ],
      itens: [
        { id: uid(), descricao: "Carburador completo", tipo: "Peça", valor: 180 },
        { id: uid(), descricao: "Revisão geral", tipo: "Mão de obra", valor: 120 },
      ],
      pagamentos: [{ id: uid(), valor: 100, forma: "Pix", data: dias(-1) }],
    },
    {
      id: uid(),
      numero: "OS-0002",
      cliente: "Maria Santos",
      telefone: "(31) 97777-4455",
      tipoMaquina: "Roçadeira",
      marca: "Husqvarna",
      modelo: "143R",
      problema: "Vazamento de combustível no tanque.",
      status: "Recebida",
      prazo: dias(3),
      criadaEm: dias(-1),
      historico: [{ data: dias(-1), texto: "Ordem criada" }],
      itens: [],
      pagamentos: [],
    },
    {
      id: uid(),
      numero: "OS-0003",
      cliente: "Sítio Boa Vista",
      tipoMaquina: "Gerador",
      marca: "Toyama",
      problema: "Gerador liga mas não gera energia.",
      status: "Aguardando peças",
      prazo: dias(-1),
      criadaEm: dias(-8),
      historico: [
        { data: dias(-8), texto: "Ordem criada" },
        { data: dias(-6), texto: "Status alterado para Aguardando peças" },
      ],
      itens: [{ id: uid(), descricao: "Placa AVR", tipo: "Peça", valor: 260 }],
      pagamentos: [],
    },
    {
      id: uid(),
      numero: "OS-0004",
      cliente: "Carlos Dias",
      telefone: "(31) 96666-7788",
      tipoMaquina: "Cortador de grama",
      marca: "Tramontina",
      problema: "Lâmina desbalanceada, muita vibração.",
      status: "Pronta",
      prazo: dias(0),
      criadaEm: dias(-5),
      concluidaEm: dias(-1),
      historico: [
        { data: dias(-5), texto: "Ordem criada" },
        { data: dias(-1), texto: "Serviço concluído — máquina pronta para retirada" },
      ],
      itens: [
        { id: uid(), descricao: "Lâmina nova", tipo: "Peça", valor: 95 },
        { id: uid(), descricao: "Balanceamento", tipo: "Mão de obra", valor: 60 },
      ],
      pagamentos: [],
    },
    {
      id: uid(),
      numero: "OS-0005",
      cliente: "Fazenda Três Rios",
      tipoMaquina: "Motobomba",
      marca: "Branco",
      modelo: "B4T 710",
      problema: "Perda de pressão na bomba.",
      status: "Aguardando aprovação",
      prazo: dias(4),
      criadaEm: dias(-2),
      historico: [
        { data: dias(-2), texto: "Ordem criada" },
        { data: dias(-2), texto: "Status alterado para Aguardando aprovação" },
      ],
      itens: [{ id: uid(), descricao: "Kit selo mecânico", tipo: "Peça", valor: 140 }],
      pagamentos: [],
    },
    {
      id: uid(),
      numero: "OS-0006",
      cliente: "Antônio Lima",
      telefone: "(31) 95555-2211",
      tipoMaquina: "Máquina agrícola",
      marca: "Agrale",
      problema: "Troca de óleo e revisão preventiva.",
      status: "Entregue",
      criadaEm: dias(-12),
      concluidaEm: dias(-9),
      entregueEm: dias(-8),
      historico: [
        { data: dias(-12), texto: "Ordem criada" },
        { data: dias(-9), texto: "Serviço concluído — máquina pronta para retirada" },
        { data: dias(-8), texto: "Status alterado para Entregue" },
      ],
      itens: [
        { id: uid(), descricao: "Óleo e filtros", tipo: "Peça", valor: 210 },
        { id: uid(), descricao: "Revisão preventiva", tipo: "Mão de obra", valor: 150 },
      ],
      pagamentos: [{ id: uid(), valor: 360, forma: "Dinheiro", data: dias(-8) }],
    },
  ];
}

let state: Ordem[] = demo();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadOrdens() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Ordem[];
    else persist();
  } catch {
    /* ignore */
  }
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

function update(id: string, fn: (o: Ordem) => Ordem) {
  state = state.map((o) => (o.id === id ? fn(o) : o));
  persist();
  emit();
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
  persist();
  emit();
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

export function registrarPagamento(id: string, valor: number, forma: Pagamento["forma"]) {
  const agora = new Date().toISOString();
  update(id, (o) => ({
    ...o,
    pagamentos: [...o.pagamentos, { id: uid(), valor, forma, data: agora }],
    historico: [
      ...o.historico,
      { data: agora, texto: `Pagamento de ${moeda(valor)} recebido via ${forma}` },
    ],
  }));
}

export function excluirOrdem(id: string) {
  state = state.filter((o) => o.id !== id);
  persist();
  emit();
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
