import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export const STATUS = [
  "Recebida",
  "Em diagnóstico",
  "Aguardando aprovação",
  "Aguardando peças",
  "Em manutenção",
  "Pronta",
  "Entregue",
] as const;

type J = { data: string; texto: string };
export type OrdemRow = {
  id: string;
  numero: string;
  cliente: string;
  telefone: string | null;
  tipo_maquina: string;
  marca: string | null;
  modelo: string | null;
  problema: string;
  prazo: string | null;
  status: string;
  criada_em: string;
  historico: J[];
  itens: { id: string; descricao: string; tipo: string; valor: number }[];
  pagamentos: { id: string; valor: number; forma: string; data: string }[];
};

export function db(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado");
  return supabaseForUser(ctx);
}

export async function buscar(ctx: ToolContext, ref: string): Promise<OrdemRow> {
  const q = db(ctx).from("ordens").select("*");
  const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
  const { data, error } = await (isUuid ? q.eq("id", ref) : q.ilike("numero", ref)).maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError(`Ordem ${ref} não encontrada`);
  return data as unknown as OrdemRow;
}

export async function salvar(ctx: ToolContext, id: string, patch: Record<string, unknown>) {
  const { error } = await db(ctx).from("ordens").update(patch as never).eq("id", id);
  if (error) throw new ToolError(error.message);
}

const soma = (a: { valor: number }[]) => a.reduce((s, x) => s + Number(x.valor), 0);

export function resumo(o: OrdemRow) {
  const total = soma(o.itens);
  const pago = soma(o.pagamentos);
  return {
    id: o.id,
    numero: o.numero,
    cliente: o.cliente,
    telefone: o.telefone,
    maquina: [o.tipo_maquina, o.marca, o.modelo].filter(Boolean).join(" "),
    problema: o.problema,
    status: o.status,
    prazo: o.prazo,
    criadaEm: o.criada_em,
    total,
    pago,
    saldo: total - pago,
  };
}

export function detalhe(o: OrdemRow) {
  return {
    ...resumo(o),
    itens: o.itens.map((i) => ({ descricao: i.descricao, tipo: i.tipo, valor: Number(i.valor) })),
    pagamentos: o.pagamentos.map((p) => ({ valor: Number(p.valor), forma: p.forma, data: p.data })),
    historico: o.historico.map((h) => ({ data: h.data, texto: h.texto })),
  };
}

export const txt = (v: unknown) => [{ type: "text" as const, text: JSON.stringify(v, null, 2) }];
