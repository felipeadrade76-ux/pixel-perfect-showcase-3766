import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buscar, db, txt } from "../shared";

export default defineTool({
  name: "registrar_pagamento",
  title: "Registrar pagamento",
  description: "Registra um pagamento manual em uma ordem através de operação transacional.",
  inputSchema: {
    ordem: z.string().min(1).describe("Número da ordem ou UUID."),
    valor: z.number().positive().describe("Valor em reais, até duas casas decimais."),
    forma: z.enum(["Pix", "Dinheiro", "Cartão"]),
    requisicaoId: z
      .string()
      .uuid()
      .describe("Identificador único do lançamento para repetição segura."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ ordem, valor, forma, requisicaoId }, ctx) => {
    const o = await buscar(ctx, ordem);
    if (!Number.isFinite(valor) || Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-7) {
      throw new ToolError("Valor inválido: use no máximo duas casas decimais.");
    }
    const { data, error } = await db(ctx).rpc("oficinia_registrar_pagamento", {
      p_ordem: o.id,
      p_pagamento_id: requisicaoId,
      p_valor: valor,
      p_forma: forma,
    });
    if (error || !data) throw new ToolError(error?.message ?? "Pagamento não confirmado.");
    return { content: txt({ numero: o.numero, pagamento: { id: requisicaoId, valor, forma } }) };
  },
});
