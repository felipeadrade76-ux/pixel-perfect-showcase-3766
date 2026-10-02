import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiUser } from "@/lib/api-auth.server";
import { extractSigningMaterial } from "@/lib/nfse/certificate.server";
import { signDpsXml, type DpsFiscalProfile, type DpsSnapshot } from "@/lib/nfse/dps-xml";
import {
  firstNfseError,
  lookupDps,
  lookupNfse,
  postSignedDps,
} from "@/lib/nfse/nacional-transport";
import { getNfseServerConfig } from "@/lib/nfse/server-config";

type ObjectJson = { [key: string]: Json | undefined };

function objectJson(value: Json): ObjectJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function stringValue(object: ObjectJson, key: string): string | undefined {
  const value = object[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function descricaoServico(servico: Json): string {
  const object = objectJson(servico);
  const itens = object["itens"];
  const descricoes = Array.isArray(itens)
    ? itens
        .map((item) => objectJson(item))
        .filter((item) => stringValue(item, "tipo") === "Mão de obra")
        .map((item) => stringValue(item, "descricao"))
        .filter((value): value is string => Boolean(value))
    : [];

  const problema = stringValue(object, "problema");
  const value = descricoes.length ? descricoes.join("; ") : problema;
  return (value || "Serviço de manutenção e reparo").slice(0, 2000);
}

function profileFromConfig(config: ReturnType<typeof getNfseServerConfig>): DpsFiscalProfile {
  if (
    !config.cnpj ||
    !config.municipioIbge ||
    !config.serieDps ||
    !config.codigoServico ||
    !config.opcaoSimplesNacional ||
    !config.regimeEspecialTributacao ||
    !config.tributacaoIssqn ||
    !config.retencaoIssqn
  ) {
    throw new Error("NFSE_NOT_READY");
  }

  return {
    ambiente: config.ambiente,
    cnpj: config.cnpj,
    inscricaoMunicipal: config.inscricaoMunicipal,
    municipioIbge: config.municipioIbge,
    serieDps: config.serieDps,
    codigoServico: config.codigoServico,
    codigoServicoMunicipal: config.codigoServicoMunicipal,
    opcaoSimplesNacional: config.opcaoSimplesNacional,
    regimeApuracaoSimples: config.regimeApuracaoSimples,
    regimeEspecialTributacao: config.regimeEspecialTributacao,
    tributacaoIssqn: config.tributacaoIssqn,
    retencaoIssqn: config.retencaoIssqn,
  };
}

function snapshotFromDocument(documento: {
  numero_dps: number | null;
  valor_servicos: number;
  tomador: Json;
  servico: Json;
  criado_em: string;
}): DpsSnapshot {
  if (!documento.numero_dps) throw new Error("DPS_NOT_RESERVED");
  const tomador = objectJson(documento.tomador);
  const nome = stringValue(tomador, "nome");
  const documentoFiscal = stringValue(tomador, "documento");
  if (!nome || !documentoFiscal) throw new Error("TOMADOR_INVALIDO");

  return {
    numeroDps: documento.numero_dps,
    valorServicos: Number(documento.valor_servicos),
    tomador: {
      nome,
      documento: documentoFiscal,
      email: stringValue(tomador, "email"),
      telefone: stringValue(tomador, "telefone"),
    },
    descricaoServico: descricaoServico(documento.servico),
    emitidaEm: documento.criado_em,
    competencia: documento.criado_em.slice(0, 10),
  };
}

function jsonError(status: number, code: string, message: string, extra?: object) {
  return Response.json(
    { ok: false, code, message, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function markEmitted(options: {
  id: string;
  userId: string;
  status: number;
  idDps: string;
  chaveAcesso: string;
  xml: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("documentos_fiscais")
    .update({
      status: "emitido",
      provedor: "nacional",
      id_dps: options.idDps,
      chave_acesso: options.chaveAcesso,
      xml_nfse: options.xml,
      ultimo_http_status: options.status,
      erro_codigo: null,
      erro_mensagem: null,
      emitido_em: new Date().toISOString(),
    })
    .eq("id", options.id)
    .eq("user_id", options.userId)
    .select("*")
    .single();

  if (error || !data) throw new Error("FISCAL_UPDATE_FAILED");
  return data;
}

export const Route = createFileRoute("/api/nfse/emit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let userId: string;
        try {
          userId = await requireApiUser(request);
        } catch {
          return jsonError(401, "unauthorized", "Sessão inválida. Entre novamente.");
        }

        const config = getNfseServerConfig();
        if (!config.ready || config.provider !== "nacional") {
          return jsonError(503, "nfse_not_ready", "A emissão fiscal ainda não está configurada.", {
            missing: config.missing,
            invalid: config.invalid,
            productionBlocked: config.productionBlocked,
          });
        }

        if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          return jsonError(
            503,
            "server_not_ready",
            "O servidor de homologação ainda não possui a credencial administrativa necessária.",
          );
        }

        let input: { documentoId?: unknown };
        try {
          input = (await request.json()) as { documentoId?: unknown };
        } catch {
          return jsonError(400, "invalid_json", "Pedido fiscal inválido.");
        }

        if (typeof input.documentoId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.documentoId)) {
          return jsonError(400, "invalid_document", "Documento fiscal inválido.");
        }

        const { data: existing, error: existingError } = await supabaseAdmin
          .from("documentos_fiscais")
          .select("*")
          .eq("id", input.documentoId)
          .eq("user_id", userId)
          .single();

        if (existingError || !existing) {
          return jsonError(404, "not_found", "Rascunho fiscal não encontrado.");
        }

        if (existing.status === "emitido" && existing.chave_acesso) {
          return Response.json(
            {
              ok: true,
              alreadyEmitted: true,
              chaveAcesso: existing.chave_acesso,
              documento: existing,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        const { data: reserved, error: reserveError } = await supabaseAdmin.rpc(
          "ritmeia_reservar_dps",
          {
            p_user_id: userId,
            p_documento_id: existing.id,
            p_serie: config.serieDps!,
          },
        );

        if (reserveError || !reserved) {
          return jsonError(409, "dps_reservation_failed", "Não foi possível reservar a DPS.");
        }

        const profile = profileFromConfig(config);
        const snapshot = snapshotFromDocument(reserved);

        if (
          reserved.id_dps &&
          reserved.tentativas > 0 &&
          config.apiBaseUrl &&
          config.certificatePath &&
          config.certificatePassword
        ) {
          try {
            const reconciliation = await lookupDps({
              baseUrl: config.apiBaseUrl,
              idDps: reserved.id_dps,
              certificatePath: config.certificatePath,
              certificatePassword: config.certificatePassword,
            });

            if (reconciliation.found && reconciliation.chaveAcesso) {
              const nfse = await lookupNfse({
                baseUrl: config.apiBaseUrl,
                chaveAcesso: reconciliation.chaveAcesso,
                certificatePath: config.certificatePath,
                certificatePassword: config.certificatePassword,
              });

              if (nfse.found && nfse.xml) {
                const emitted = await markEmitted({
                  id: reserved.id,
                  userId,
                  status: nfse.status,
                  idDps: reserved.id_dps,
                  chaveAcesso: reconciliation.chaveAcesso,
                  xml: nfse.xml,
                });
                return Response.json(
                  {
                    ok: true,
                    reconciled: true,
                    chaveAcesso: reconciliation.chaveAcesso,
                    documento: emitted,
                  },
                  { headers: { "Cache-Control": "no-store" } },
                );
              }

              return jsonError(
                202,
                "issued_pending_retrieval",
                "A NFS-e já foi localizada no emissor; aguarde a recuperação do XML antes de reenviar.",
                { chaveAcesso: reconciliation.chaveAcesso },
              );
            }
          } catch {
            // Reconciliation failure must never consume a new DPS number. The same reservation is reused below.
          }
        }

        if (!config.certificatePath || !config.certificatePassword || !config.apiBaseUrl) {
          return jsonError(503, "nfse_not_ready", "Certificado ou API fiscal não configurados.");
        }

        let signed: { id: string; xml: string };
        try {
          const material = await extractSigningMaterial(
            config.certificatePath,
            config.certificatePassword,
          );
          signed = signDpsXml(profile, snapshot, material.privateKeyPem, material.certificatePem);
        } catch {
          return jsonError(
            503,
            "certificate_error",
            "Não foi possível usar o certificado digital configurado.",
          );
        }

        const attemptAt = new Date().toISOString();
        await supabaseAdmin
          .from("documentos_fiscais")
          .update({
            status: "enviando",
            id_dps: signed.id,
            provedor: "nacional",
            tentativas: reserved.tentativas + 1,
            ultima_tentativa_em: attemptAt,
            erro_codigo: null,
            erro_mensagem: null,
          })
          .eq("id", reserved.id)
          .eq("user_id", userId);

        try {
          const result = await postSignedDps({
            baseUrl: config.apiBaseUrl,
            signedDpsXml: signed.xml,
            certificatePath: config.certificatePath,
            certificatePassword: config.certificatePassword,
          });

          if (result.ok) {
            const emitted = await markEmitted({
              id: reserved.id,
              userId,
              status: result.status,
              idDps: result.data.idDps || signed.id,
              chaveAcesso: result.data.chaveAcesso,
              xml: result.xml,
            });
            return Response.json(
              { ok: true, chaveAcesso: result.data.chaveAcesso, documento: emitted },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          const first = firstNfseError(result.data);
          const nextStatus = result.retryable ? "pronto" : "rejeitado";
          await supabaseAdmin
            .from("documentos_fiscais")
            .update({
              status: nextStatus,
              ultimo_http_status: result.status,
              erro_codigo: first.code ?? `HTTP_${result.status}`,
              erro_mensagem:
                first.message ??
                (result.retryable
                  ? "Falha temporária na comunicação com o emissor."
                  : "A DPS foi rejeitada pelo emissor."),
            })
            .eq("id", reserved.id)
            .eq("user_id", userId);

          return jsonError(
            result.retryable ? 503 : 422,
            result.retryable ? "temporary_failure" : "rejected",
            first.message ??
              (result.retryable
                ? "O emissor está temporariamente indisponível. A mesma DPS será reutilizada na próxima tentativa."
                : "A DPS foi rejeitada pelo emissor."),
            { retryable: result.retryable, fiscalCode: first.code },
          );
        } catch {
          await supabaseAdmin
            .from("documentos_fiscais")
            .update({
              status: "pronto",
              erro_codigo: "NETWORK",
              erro_mensagem:
                "Falha de rede antes da confirmação. A próxima tentativa consultará a DPS antes de reenviar.",
            })
            .eq("id", reserved.id)
            .eq("user_id", userId);

          return jsonError(
            503,
            "temporary_failure",
            "A comunicação com o emissor falhou. A DPS foi preservada para reconciliação segura.",
            { retryable: true },
          );
        }
      },
    },
  },
});
