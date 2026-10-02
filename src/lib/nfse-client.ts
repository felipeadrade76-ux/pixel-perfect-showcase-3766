import { supabase } from "@/integrations/supabase/client";

export type NfseReadiness = {
  provider: string;
  ambiente: string;
  enabled: boolean;
  supported: boolean;
  ready: boolean;
  missing: string[];
  invalid: string[];
  productionBlocked: boolean;
};

export async function carregarNfseReadiness(): Promise<NfseReadiness> {
  const response = await fetch("/api/nfse/status", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível verificar a configuração fiscal.");
  return (await response.json()) as NfseReadiness;
}

export async function emitirNfseRemota(documentoId: string): Promise<{ chaveAcesso?: string }> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sua sessão expirou. Entre novamente.");

  const response = await fetch("/api/nfse/emit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify({ documentoId }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; chaveAcesso?: string }
    | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Não foi possível emitir a NFS-e.");
  }
  return { chaveAcesso: payload.chaveAcesso };
}
