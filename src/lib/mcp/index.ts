import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarOrdens from "./tools/listar-ordens";
import verOrdem from "./tools/ver-ordem";
import criarOrdem from "./tools/criar-ordem";
import alterarStatus from "./tools/alterar-status";
import adicionarItem from "./tools/adicionar-item";
import registrarPagamento from "./tools/registrar-pagamento";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
if (!supabaseUrl)
  throw new Error("A URL do Supabase é obrigatória para iniciar as ferramentas MCP.");
const authIssuer = new URL("/auth/v1", supabaseUrl).toString();

export default defineMcp({
  name: "oficinia",
  title: "OficinIA",
  version: "0.1.0",
  instructions:
    "Ferramentas da Oficina Inteligente (oficina de motosserras, roçadeiras, geradores etc.). Use `listar_ordens` para ver as ordens, `ver_ordem` para detalhes, `criar_ordem` para nova entrada, `alterar_status`, `adicionar_item` e `registrar_pagamento` para atualizar. Valores em reais (BRL).",
  auth: auth.oauth.issuer({
    issuer: authIssuer,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarOrdens, verOrdem, criarOrdem, alterarStatus, adicionarItem, registrarPagamento],
});
