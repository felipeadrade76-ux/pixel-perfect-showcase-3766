import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DocumentoFiscal = Database["public"]["Tables"]["documentos_fiscais"]["Row"];

export async function listarDocumentosDaOrdem(ordemId: string): Promise<DocumentoFiscal[]> {
  const { data, error } = await supabase
    .from("documentos_fiscais")
    .select("*")
    .eq("ordem_id", ordemId)
    .order("criado_em", { ascending: false });

  if (error || !data) {
    throw new Error("Não foi possível carregar a preparação fiscal desta ordem.");
  }

  return data;
}

export async function prepararNfse(ordemId: string, documentoId: string): Promise<DocumentoFiscal> {
  const { data, error } = await supabase.rpc("ritmeia_preparar_nfse", {
    p_ordem: ordemId,
    p_documento_id: documentoId,
    p_ambiente: "homologacao",
  });

  if (error || !data) {
    const message = error?.message ?? "";
    if (message.includes("Complete CPF/CNPJ")) {
      throw new Error("Complete CPF/CNPJ e cidade/UF no cadastro do cliente antes de preparar a NFS-e.");
    }
    if (message.includes("valor de servico")) {
      throw new Error("Adicione um valor de serviço à ordem antes de preparar a NFS-e.");
    }
    if (message.includes("cliente cadastrado")) {
      throw new Error("Vincule esta ordem a um cliente cadastrado antes de preparar a NFS-e.");
    }
    throw new Error("Não foi possível preparar a NFS-e. Tente novamente.");
  }

  return data;
}

export function resumoTomador(documento: DocumentoFiscal) {
  const tomador = documento.tomador;
  if (!tomador || typeof tomador !== "object" || Array.isArray(tomador)) return "Cliente";
  const nome = tomador["nome"];
  return typeof nome === "string" && nome.trim() ? nome : "Cliente";
}
