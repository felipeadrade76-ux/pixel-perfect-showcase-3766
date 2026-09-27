import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buscar, salvar, STATUS, txt } from "../shared";

export default defineTool({
  name: "alterar_status",
  title: "Alterar status da ordem",
  description: "Muda o status de uma ordem e registra a alteração no histórico.",
  inputSchema: {
    ordem: z.string().min(1).describe("Número (ex.: OS-0003) ou id da ordem."),
    status: z.enum(STATUS),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ ordem, status }, ctx) => {
    const o = await buscar(ctx, ordem);
    const agora = new Date().toISOString();
    const texto =
      status === "Pronta"
        ? "Serviço concluído — máquina pronta para retirada"
        : `Status alterado para ${status}`;
    await salvar(ctx, o.id, {
      status,
      historico: [...o.historico, { data: agora, texto }],
      ...(status === "Pronta" ? { concluida_em: agora } : {}),
      ...(status === "Entregue" ? { entregue_em: agora } : {}),
    });
    return { content: txt({ numero: o.numero, status }) };
  },
});
