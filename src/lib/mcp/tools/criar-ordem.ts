import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { db, resumo, txt, type OrdemRow } from "../shared";

export default defineTool({
  name: "criar_ordem",
  title: "Criar ordem de serviço",
  description: "Registra a entrada de uma nova máquina na oficina com número de OS automático.",
  inputSchema: {
    cliente: z.string().trim().min(1).describe("Nome do cliente."),
    tipoMaquina: z.string().trim().min(1).describe("Ex.: Motosserra, Roçadeira, Gerador."),
    problema: z.string().trim().min(1).describe("Problema relatado."),
    telefone: z.string().optional(),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    prazo: z.string().optional().describe("Previsão de conclusão (data ISO)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (i, ctx) => {
    const c = db(ctx);
    const { data: nums } = await c.from("ordens").select("numero");
    const max = Math.max(0, ...(nums ?? []).map((r) => Number(r.numero.replace(/\D/g, "")) || 0));
    const agora = new Date().toISOString();
    const { data, error } = await c
      .from("ordens")
      .insert({
        numero: "OS-" + String(max + 1).padStart(4, "0"),
        cliente: i.cliente,
        tipo_maquina: i.tipoMaquina,
        problema: i.problema,
        telefone: i.telefone ?? null,
        marca: i.marca ?? null,
        modelo: i.modelo ?? null,
        prazo: i.prazo ?? null,
        historico: [{ data: agora, texto: "Ordem criada" }],
      })
      .select("*")
      .single();
    if (error) throw new ToolError(error.message);
    const ordem = resumo(data as unknown as OrdemRow);
    return { content: txt(ordem), structuredContent: { ordem } };
  },
});
