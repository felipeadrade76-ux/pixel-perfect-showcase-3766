import { useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import {
  listarDocumentosDaOrdem,
  prepararNfse,
  resumoTomador,
  type DocumentoFiscal,
} from "@/lib/nfse-store";
import { moeda, type Ordem } from "@/lib/oficina-store";
import {
  carregarNfseReadiness,
  emitirNfseRemota,
  type NfseReadiness,
} from "@/lib/nfse-client";

export function NfsePreparation({ ordem }: { ordem: Ordem }) {
  const [documentos, setDocumentos] = useState<DocumentoFiscal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [requisicaoId, setRequisicaoId] = useState(() => crypto.randomUUID());
  const [readiness, setReadiness] = useState<NfseReadiness | null>(null);

  useEffect(() => {
    let ativo = true;
    void carregarNfseReadiness()
      .then((status) => {
        if (ativo) setReadiness(status);
      })
      .catch(() => {
        if (ativo) setReadiness(null);
      });

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

  const atual = documentos.find((documento) => documento.status !== "cancelado");
  const desatualizado = Boolean(
    atual &&
    (atual.status === "rascunho" || atual.status === "pronto") &&
    Number(atual.ordem_revisao) !== ordem.revisao,
  );

  async function preparar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const documento = await prepararNfse(ordem.id, requisicaoId);
      setDocumentos((lista) => [documento, ...lista.filter((item) => item.id !== documento.id)]);
      setRequisicaoId(crypto.randomUUID());
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível preparar a NFS-e.");
    } finally {
      setOcupado(false);
    }
  }

  async function emitir(documento: DocumentoFiscal) {
    if (ocupado || !readiness?.ready) return;
    setOcupado(true);
    setErro("");
    try {
      await emitirNfseRemota(documento.id);
      const atualizados = await listarDocumentosDaOrdem(ordem.id);
      setDocumentos(atualizados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível emitir a NFS-e.");
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
          {desatualizado ? (
            <div className="mt-3 rounded-xl border border-warning/35 bg-warning/10 p-3">
              <p className="text-xs font-bold text-warning-foreground">
                A OS mudou depois que este rascunho foi preparado.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Atualize o rascunho antes de qualquer emissão para congelar os valores atuais.
              </p>
              <button
                type="button"
                onClick={() => void preparar()}
                disabled={ocupado}
                className="mt-3 min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                {ocupado ? "Atualizando..." : "Atualizar rascunho fiscal"}
              </button>
            </div>
          ) : null}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            Os dados deste rascunho ficam preservados mesmo se o cadastro do cliente mudar depois.
            Peças ficam separadas da mão de obra para a regra fiscal correta ser aplicada pelo
            emissor configurado.
          </p>
          <button
            type="button"
            disabled={ocupado || desatualizado || !readiness?.ready || atual.status === "emitido"}
            onClick={() => void emitir(atual)}
            className="mt-4 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-bold text-foreground disabled:text-muted-foreground disabled:opacity-60"
          >
            {atual.status === "emitido"
              ? "NFS-e emitida"
              : desatualizado
                ? "Emitir NFS-e — atualize o rascunho primeiro"
                : readiness?.ready
                  ? ocupado
                    ? "Emitindo NFS-e..."
                    : "Emitir NFS-e"
                  : "Emitir NFS-e — aguardando configuração fiscal"}
          </button>
          {atual.chave_acesso ? (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Chave de acesso: {atual.chave_acesso}
            </p>
          ) : null}
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
