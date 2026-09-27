import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { db, resumo, STATUS, txt, type OrdemRow } from "../shared";

export default defineTool({
  name: "listar_ordens",
  title: "Listar ordens de serviço",
  description: "Lista as ordens de serviço da oficina, com filtro opcional por status ou texto.",
  inputSchema: {
    status: z.enum(STATUS).optional().describe("Filtrar por status."),
    busca: z.string().optional().describe("Texto para buscar em cliente, número ou máquina."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, busca }, ctx) => {
    let q = db(ctx).from("ordens").select("*").order("criada_em", { ascending: false }).limit(100);
    if (status) q = q.eq("status", status);
    if (busca) {
      const b = busca.replace(/[%,()]/g, " ");
      q = q.or(`cliente.ilike.%${b}%,numero.ilike.%${b}%,tipo_maquina.ilike.%${b}%`);
    }
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const ordens = (data as unknown as OrdemRow[]).map(resumo);
    return { content: txt(ordens), structuredContent: { ordens } };
  },
});
