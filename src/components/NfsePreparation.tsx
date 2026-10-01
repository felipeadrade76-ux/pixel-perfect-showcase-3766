import { useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import {
  listarDocumentosDaOrdem,
  prepararNfse,
  resumoTomador,
  type DocumentoFiscal,
} from "@/lib/nfse-store";
import { moeda, type Ordem } from "@/lib/oficina-store";

export function NfsePreparation({ ordem }: { ordem: Ordem }) {
  const [documentos, setDocumentos] = useState<DocumentoFiscal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [requisicaoId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let ativo = true;
    void listarDocumentosDaOrdem(ordem.id)
      .then((data) => {
        if (ativo) setDocumentos(data);
      })
      .catch((error: unknown) => {
        if (ativo) setErro(error instanceof Error ? error.message : "Falha ao carregar NFS-e.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [ordem.id]);

  const atual = documentos[0];

  async function preparar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const documento = await prepararNfse(ordem.id, requisicaoId);
      setDocumentos((lista) => [documento, ...lista.filter((item) => item.id !== documento.id)]);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível preparar a NFS-e.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Fiscal
          </p>
          <h2 className="mt-1 font-extrabold tracking-tight">NFS-e</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A Ritmeia prepara e congela os dados da nota. A transmissão real será liberada somente
            depois da configuração fiscal da oficina e do provedor correto.
          </p>
        </div>
      </div>

      {carregando ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Verificando preparação fiscal...
        </p>
      ) : atual ? (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">Rascunho fiscal preparado</p>
              <p className="text-xs text-muted-foreground">{resumoTomador(atual)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Serviços: {moeda(Number(atual.valor_servicos))}</span>
                <span>Peças separadas: {moeda(Number(atual.valor_pecas))}</span>
              </div>
            </div>
            <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning-foreground">
              Homologação
            </span>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            Os dados deste rascunho ficam preservados mesmo se o cadastro do cliente mudar depois.
            Peças ficam separadas da mão de obra para a regra fiscal correta ser aplicada pelo
            emissor configurado.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-bold text-muted-foreground opacity-70"
          >
            Emitir NFS-e — aguardando configuração fiscal
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void preparar()}
          disabled={ocupado}
          className="mt-4 min-h-12 w-full rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-50"
        >
          {ocupado ? "Preparando dados fiscais..." : "Preparar NFS-e"}
        </button>
      )}

      {erro ? (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
