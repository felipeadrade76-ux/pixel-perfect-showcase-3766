import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarOrdens from "./tools/listar-ordens";
import verOrdem from "./tools/ver-ordem";
import criarOrdem from "./tools/criar-ordem";
import alterarStatus from "./tools/alterar-status";
import adicionarItem from "./tools/adicionar-item";
import registrarPagamento from "./tools/registrar-pagamento";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "pixel-perfect-pixels",
  title: "Pixel Perfect Pixels",
  version: "0.1.0",
  instructions:
    "Ferramentas da Oficina Inteligente (oficina de motosserras, roçadeiras, geradores etc.). Use `listar_ordens` para ver as ordens, `ver_ordem` para detalhes, `criar_ordem` para nova entrada, `alterar_status`, `adicionar_item` e `registrar_pagamento` para atualizar. Valores em reais (BRL).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarOrdens, verOrdem, criarOrdem, alterarStatus, adicionarItem, registrarPagamento],
});
