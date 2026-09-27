import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buscar, salvar, txt } from "../shared";

export default defineTool({
  name: "registrar_pagamento",
  title: "Registrar pagamento",
  description: "Registra um pagamento recebido (Pix, Dinheiro ou Cartão) em uma ordem.",
  inputSchema: {
    ordem: z.string().min(1).describe("Número (ex.: OS-0003) ou id da ordem."),
    valor: z.number().positive().describe("Valor em reais."),
    forma: z.enum(["Pix", "Dinheiro", "Cartão"]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ ordem, valor, forma }, ctx) => {
    const o = await buscar(ctx, ordem);
    const agora = new Date().toISOString();
    const brl = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await salvar(ctx, o.id, {
      pagamentos: [...o.pagamentos, { id: crypto.randomUUID(), valor, forma, data: agora }],
      historico: [...o.historico, { data: agora, texto: `Pagamento de ${brl} recebido via ${forma}` }],
    });
    return { content: txt({ numero: o.numero, pagamento: { valor, forma } }) };
  },
});
