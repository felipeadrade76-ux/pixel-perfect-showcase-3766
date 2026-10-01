import { readFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { request } from "node:https";

export type NfseNacionalSuccess = {
  tipoAmbiente: number;
  versaoAplicativo: string;
  dataHoraProcessamento: string;
  idDps: string;
  chaveAcesso: string;
  nfseXmlGZipB64: string;
  alertas?: unknown;
};

export type NfseNacionalErrorItem = {
  Codigo?: string;
  codigo?: string;
  Descricao?: string;
  descricao?: string;
  Complemento?: string | null;
  complemento?: string | null;
};

export type NfseNacionalRejected = {
  tipoAmbiente?: number;
  versaoAplicativo?: string;
  dataHoraProcessamento?: string;
  idDps?: string;
  idDPS?: string;
  erros?: NfseNacionalErrorItem[];
};

export type NfseNacionalResult =
  | { ok: true; status: number; data: NfseNacionalSuccess; xml: string }
  | { ok: false; status: number; retryable: boolean; data: NfseNacionalRejected | null; raw: string };

const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

export function gzipBase64Xml(xml: string): string {
  if (!xml.trim()) throw new Error("XML DPS vazio.");
  return gzipSync(Buffer.from(xml, "utf8"), { level: 9 }).toString("base64");
}

export function gunzipBase64Xml(value: string): string {
  if (!value.trim()) throw new Error("XML NFS-e vazio.");
  try {
    return gunzipSync(Buffer.from(value, "base64")).toString("utf8");
  } catch {
    throw new Error("Resposta NFS-e contém XML compactado inválido.");
  }
}

export function nfseEndpoint(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  } catch {
    throw new Error("URL da API NFS-e inválida.");
  }
  if (url.protocol !== "https:") throw new Error("A API NFS-e deve usar HTTPS.");
  return new URL("nfse", url);
}

export function buildNfsePostBody(signedDpsXml: string) {
  return { dpsXmlGZipB64: gzipBase64Xml(signedDpsXml) };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isSuccess(value: unknown): value is NfseNacionalSuccess {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["chaveAcesso"] === "string" &&
    typeof item["nfseXmlGZipB64"] === "string" &&
    typeof item["idDps"] === "string"
  );
}

export function parseNfseResponse(status: number, raw: string): NfseNacionalResult {
  const parsed = parseJson(raw);

  if (status >= 200 && status < 300 && isSuccess(parsed)) {
    return {
      ok: true,
      status,
      data: parsed,
      xml: gunzipBase64Xml(parsed.nfseXmlGZipB64),
    };
  }

  return {
    ok: false,
    status,
    retryable: status === 0 || status === 408 || status === 429 || status >= 500,
    data:
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as NfseNacionalRejected)
        : null,
    raw,
  };
}

export async function postSignedDps(options: {
  baseUrl: string;
  signedDpsXml: string;
  certificatePath: string;
  certificatePassword: string;
  timeoutMs?: number;
}): Promise<NfseNacionalResult> {
  const endpoint = nfseEndpoint(options.baseUrl);
  const pfx = await readFile(options.certificatePath);
  const body = JSON.stringify(buildNfsePostBody(options.signedDpsXml));
  const timeoutMs = options.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const req = request(
      endpoint,
      {
        method: "POST",
        pfx,
        passphrase: options.certificatePassword,
        rejectUnauthorized: true,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;

        res.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy(new Error("Resposta NFS-e excedeu o limite de segurança."));
            return;
          }
          chunks.push(buffer);
        });

        res.on("end", () => {
          const status = res.statusCode ?? 0;
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(parseNfseResponse(status, raw));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Tempo limite excedido ao comunicar com a NFS-e."));
    });
    req.on("error", reject);
    req.end(body);
  });
}
