import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Cliente = {
  id: string;
  nome: string;
  telefone?: string;
  documento?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Equipamento = {
  id: string;
  clienteId: string;
  tipo: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  apelido?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
};

type ClienteRow = {
  id: string;
  nome: string;
  telefone: string | null;
  documento: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

type EquipamentoRow = {
  id: string;
  cliente_id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  apelido: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

const optional = (value: string | null | undefined) => value ?? undefined;
const somenteDigitos = (value?: string) => value?.replace(/\D/g, "") || undefined;

function clienteFromRow(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    telefone: optional(row.telefone),
    documento: optional(row.documento),
    email: optional(row.email),
    cep: optional(row.cep),
    logradouro: optional(row.logradouro),
    numero: optional(row.numero),
    complemento: optional(row.complemento),
    bairro: optional(row.bairro),
    cidade: optional(row.cidade),
    uf: optional(row.uf),
    observacoes: optional(row.observacoes),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function equipamentoFromRow(row: EquipamentoRow): Equipamento {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    tipo: row.tipo,
    marca: optional(row.marca),
    modelo: optional(row.modelo),
    serie: optional(row.serie),
    apelido: optional(row.apelido),
    observacoes: optional(row.observacoes),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

let clientes: Cliente[] = [];
let equipamentos: Equipamento[] = [];
let usuarioAtivo: string | null = null;
let sessaoVersao = 0;
let cargaVersao = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY_CLIENTES: Cliente[] = [];
const EMPTY_EQUIPAMENTOS: Equipamento[] = [];

export function useClientes() {
  return useSyncExternalStore(subscribe, () => clientes, () => EMPTY_CLIENTES);
}

export function useEquipamentos() {
  return useSyncExternalStore(subscribe, () => equipamentos, () => EMPTY_EQUIPAMENTOS);
}

export function useCliente(id: string) {
  return useClientes().find((cliente) => cliente.id === id);
}

export function limparClientes() {
  ++cargaVersao;
  ++sessaoVersao;
  usuarioAtivo = null;
  clientes = [];
  equipamentos = [];
  emit();
}

export function selecionarUsuarioClientes(id: string): boolean {
  if (usuarioAtivo === id) return false;
  limparClientes();
  usuarioAtivo = id;
  return true;
}

async function carregarTabela<T>(
  tabela: "clientes" | "equipamentos",
  ordem: string,
): Promise<T[]> {
  const pagina = 500;
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .order(ordem, { ascending: tabela === "clientes" })
      .order("id", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error || !data) throw new Error("Falha ao carregar o cadastro. Confira a internet.");
    todas.push(...(data as T[]));
    if (data.length < pagina) break;
  }
  return todas;
}

export async function loadClientes(): Promise<void> {
  if (typeof window === "undefined") return;
  const versao = ++cargaVersao;
  const usuario = usuarioAtivo;
  const [clienteRows, equipamentoRows] = await Promise.all([
    carregarTabela<ClienteRow>("clientes", "nome"),
    carregarTabela<EquipamentoRow>("equipamentos", "criado_em"),
  ]);
  if (versao !== cargaVersao || usuario !== usuarioAtivo) return;
  clientes = clienteRows.map(clienteFromRow);
  equipamentos = equipamentoRows.map(equipamentoFromRow);
  emit();
}

export type ClienteInput = Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">;

function clientePayload(input: Partial<ClienteInput>) {
  return {
    nome: input.nome?.trim(),
    telefone: input.telefone?.trim() || null,
    documento: somenteDigitos(input.documento) ?? null,
    email: input.email?.trim().toLowerCase() || null,
    cep: somenteDigitos(input.cep) ?? null,
    logradouro: input.logradouro?.trim() || null,
    numero: input.numero?.trim() || null,
    complemento: input.complemento?.trim() || null,
    bairro: input.bairro?.trim() || null,
    cidade: input.cidade?.trim() || null,
    uf: input.uf?.trim().toUpperCase().slice(0, 2) || null,
    observacoes: input.observacoes?.trim() || null,
  };
}

export async function criarCliente(input: ClienteInput, requisicaoId = crypto.randomUUID()): Promise<Cliente> {
  if (!input.nome.trim()) throw new Error("Informe o nome do cliente.");
  const usuario = usuarioAtivo;
  const versao = sessaoVersao;
  const { data, error } = await supabase
    .from("clientes")
    .insert({ id: requisicaoId, ...clientePayload(input), nome: input.nome.trim() })
    .select("*")
    .single();
  let salva = data;
  if (error?.code === "23505") {
    const repetido = await supabase
      .from("clientes")
      .select("*")
      .eq("id", requisicaoId)
      .maybeSingle();
    if (!repetido.error && repetido.data) salva = repetido.data;
    else throw new Error("Já existe um cliente com este CPF/CNPJ.");
  }
  if (!salva) throw new Error("Não foi possível salvar o cliente. Tente novamente.");
  if (usuario !== usuarioAtivo || versao !== sessaoVersao) {
    throw new Error("A sessão mudou durante o cadastro. Entre novamente.");
  }
  const cliente = clienteFromRow(salva as ClienteRow);
  clientes = [...clientes.filter((item) => item.id !== cliente.id), cliente].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  emit();
  return cliente;
}

export async function editarCliente(id: string, input: Partial<ClienteInput>): Promise<Cliente> {
  if (input.nome !== undefined && !input.nome.trim()) throw new Error("Informe o nome do cliente.");
  const usuario = usuarioAtivo;
  const versao = sessaoVersao;
  const payload = clientePayload(input);
  if (input.nome === undefined) delete (payload as { nome?: string }).nome;
  const { data, error } = await supabase
    .from("clientes")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error("Não foi possível atualizar o cliente.");
  if (usuario !== usuarioAtivo || versao !== sessaoVersao) {
    throw new Error("A sessão mudou durante a atualização.");
  }
  const cliente = clienteFromRow(data as ClienteRow);
  clientes = clientes.map((item) => (item.id === id ? cliente : item));
  emit();
  return cliente;
}

export type EquipamentoInput = Omit<
  Equipamento,
  "id" | "criadoEm" | "atualizadoEm" | "clienteId"
>;

function equipamentoPayload(clienteId: string, input: Partial<EquipamentoInput>) {
  return {
    cliente_id: clienteId,
    tipo: input.tipo?.trim(),
    marca: input.marca?.trim() || null,
    modelo: input.modelo?.trim() || null,
    serie: input.serie?.trim() || null,
    apelido: input.apelido?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
  };
}

export async function criarEquipamento(
  clienteId: string,
  input: EquipamentoInput,
  requisicaoId = crypto.randomUUID(),
): Promise<Equipamento> {
  if (!input.tipo.trim()) throw new Error("Informe o tipo da máquina.");
  const usuario = usuarioAtivo;
  const versao = sessaoVersao;
  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      id: requisicaoId,
      ...equipamentoPayload(clienteId, input),
      cliente_id: clienteId,
      tipo: input.tipo.trim(),
    })
    .select("*")
    .single();
  let salva = data;
  if (error?.code === "23505") {
    const repetido = await supabase
      .from("equipamentos")
      .select("*")
      .eq("id", requisicaoId)
      .maybeSingle();
    if (!repetido.error && repetido.data) salva = repetido.data;
    else throw new Error("Já existe uma máquina com este número de série.");
  }
  if (!salva) throw new Error("Não foi possível salvar a máquina.");
  if (usuario !== usuarioAtivo || versao !== sessaoVersao) {
    throw new Error("A sessão mudou durante o cadastro da máquina.");
  }
  const equipamento = equipamentoFromRow(salva as EquipamentoRow);
  equipamentos = [equipamento, ...equipamentos.filter((item) => item.id !== equipamento.id)];
  emit();
  return equipamento;
}

export async function editarEquipamento(
  id: string,
  clienteId: string,
  input: Partial<EquipamentoInput>,
): Promise<Equipamento> {
  if (input.tipo !== undefined && !input.tipo.trim()) throw new Error("Informe o tipo da máquina.");
  const payload = equipamentoPayload(clienteId, input);
  if (input.tipo === undefined) delete (payload as { tipo?: string }).tipo;
  const usuario = usuarioAtivo;
  const versao = sessaoVersao;
  const { data, error } = await supabase
    .from("equipamentos")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error("Não foi possível atualizar a máquina.");
  if (usuario !== usuarioAtivo || versao !== sessaoVersao) {
    throw new Error("A sessão mudou durante a atualização.");
  }
  const equipamento = equipamentoFromRow(data as EquipamentoRow);
  equipamentos = equipamentos.map((item) => (item.id === id ? equipamento : item));
  emit();
  return equipamento;
}

export function equipamentosDoCliente(clienteId: string, lista = equipamentos) {
  return lista.filter((equipamento) => equipamento.clienteId === clienteId);
}

export function dadosFiscaisCompletos(cliente: Cliente) {
  return Boolean(cliente.documento && cliente.cidade && cliente.uf);
}
