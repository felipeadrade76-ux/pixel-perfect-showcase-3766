import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buscar, detalhe, txt } from "../shared";

export default defineTool({
  name: "ver_ordem",
  title: "Ver ordem de serviço",
  description: "Mostra os detalhes de uma ordem: itens, pagamentos, saldo e histórico.",
  inputSchema: { ordem: z.string().min(1).describe("Número (ex.: OS-0003) ou id da ordem.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ ordem }, ctx) => {
    const o = detalhe(await buscar(ctx, ordem));
    return { content: txt(o), structuredContent: { ordem: o } };
  },
});
