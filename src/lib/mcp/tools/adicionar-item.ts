import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buscar, salvar, txt } from "../shared";

export default defineTool({
  name: "adicionar_item",
  title: "Adicionar peça ou mão de obra",
  description: "Adiciona uma peça ou serviço de mão de obra (com valor em reais) a uma ordem.",
  inputSchema: {
    ordem: z.string().min(1).describe("Número (ex.: OS-0003) ou id da ordem."),
    descricao: z.string().trim().min(1),
    tipo: z.enum(["Peça", "Mão de obra"]),
    valor: z.number().nonnegative().describe("Valor em reais."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ ordem, descricao, tipo, valor }, ctx) => {
    const o = await buscar(ctx, ordem);
    const agora = new Date().toISOString();
    await salvar(ctx, o.id, {
      itens: [...o.itens, { id: crypto.randomUUID(), descricao, tipo, valor }],
      historico: [...o.historico, { data: agora, texto: `${tipo} adicionada: ${descricao}` }],
    }, o.revisao);
    return { content: txt({ numero: o.numero, adicionado: { descricao, tipo, valor } }) };
  },
});
