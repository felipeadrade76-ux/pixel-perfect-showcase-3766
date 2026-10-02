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
  | {
      ok: false;
      status: number;
      retryable: boolean;
      data: NfseNacionalRejected | null;
      raw: string;
    };

export type DpsLookupResult = {
  status: number;
  found: boolean;
  chaveAcesso?: string | undefined;
  raw: string;
};

export type NfseLookupResult = {
  status: number;
  found: boolean;
  xml?: string | undefined;
  raw: string;
};

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

function baseEndpoint(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  } catch {
    throw new Error("URL da API NFS-e inválida.");
  }
  if (url.protocol !== "https:") throw new Error("A API NFS-e deve usar HTTPS.");
  return url;
}

export function nfseEndpoint(baseUrl: string): URL {
  return new URL("nfse", baseEndpoint(baseUrl));
}

export function dpsLookupEndpoint(baseUrl: string, idDps: string): URL {
  return new URL("dps/" + encodeURIComponent(idDps), baseEndpoint(baseUrl));
}

export function nfseLookupEndpoint(baseUrl: string, chaveAcesso: string): URL {
  return new URL("nfse/" + encodeURIComponent(chaveAcesso), baseEndpoint(baseUrl));
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

function findString(value: unknown, names: string[]): string | undefined {
  if (typeof value === "string") return undefined;
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findString(child, names);
      if (found) return found;
    }
    return undefined;
  }
  const object = value as Record<string, unknown>;
  for (const name of names) {
    const candidate = object[name];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const child of Object.values(object)) {
    const found = findString(child, names);
    if (found) return found;
  }
  return undefined;
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

async function mTlsRequest(options: {
  url: URL;
  method: "GET" | "HEAD" | "POST";
  certificatePath: string;
  certificatePassword: string;
  body?: string | undefined;
  timeoutMs?: number | undefined;
}): Promise<{ status: number; raw: string }> {
  const pfx = await readFile(options.certificatePath);
  const timeoutMs = options.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const req = request(
      options.url,
      {
        method: options.method,
        pfx,
        passphrase: options.certificatePassword,
        rejectUnauthorized: true,
        headers: {
          Accept: "application/json",
          ...(options.body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(options.body),
              }
            : {}),
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
          resolve({
            status: res.statusCode ?? 0,
            raw: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Tempo limite excedido ao comunicar com a NFS-e."));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function postSignedDps(options: {
  baseUrl: string;
  signedDpsXml: string;
  certificatePath: string;
  certificatePassword: string;
  timeoutMs?: number;
}): Promise<NfseNacionalResult> {
  const body = JSON.stringify(buildNfsePostBody(options.signedDpsXml));
  const response = await mTlsRequest({
    url: nfseEndpoint(options.baseUrl),
    method: "POST",
    certificatePath: options.certificatePath,
    certificatePassword: options.certificatePassword,
    body,
    timeoutMs: options.timeoutMs,
  });
  return parseNfseResponse(response.status, response.raw);
}

export async function lookupDps(options: {
  baseUrl: string;
  idDps: string;
  certificatePath: string;
  certificatePassword: string;
  timeoutMs?: number;
}): Promise<DpsLookupResult> {
  const response = await mTlsRequest({
    url: dpsLookupEndpoint(options.baseUrl, options.idDps),
    method: "GET",
    certificatePath: options.certificatePath,
    certificatePassword: options.certificatePassword,
    timeoutMs: options.timeoutMs,
  });
  const parsed = parseJson(response.raw);
  const chaveAcesso = findString(parsed, ["chaveAcesso", "chave", "chNFSe"]);
  return {
    status: response.status,
    found: response.status >= 200 && response.status < 300 && Boolean(chaveAcesso),
    chaveAcesso,
    raw: response.raw,
  };
}

export async function lookupNfse(options: {
  baseUrl: string;
  chaveAcesso: string;
  certificatePath: string;
  certificatePassword: string;
  timeoutMs?: number;
}): Promise<NfseLookupResult> {
  const response = await mTlsRequest({
    url: nfseLookupEndpoint(options.baseUrl, options.chaveAcesso),
    method: "GET",
    certificatePath: options.certificatePath,
    certificatePassword: options.certificatePassword,
    timeoutMs: options.timeoutMs,
  });

  if (response.status < 200 || response.status >= 300) {
    return { status: response.status, found: false, raw: response.raw };
  }

  if (response.raw.trim().startsWith("<")) {
    return { status: response.status, found: true, xml: response.raw, raw: response.raw };
  }

  const parsed = parseJson(response.raw);
  const zipped = findString(parsed, ["nfseXmlGZipB64", "xmlGZipB64"]);
  const xml = zipped ? gunzipBase64Xml(zipped) : findString(parsed, ["xml", "nfseXml"]);

  return {
    status: response.status,
    found: Boolean(xml),
    xml,
    raw: response.raw,
  };
}

export function firstNfseError(result: NfseNacionalRejected | null): {
  code?: string | undefined;
  message?: string | undefined;
} {
  const error = result?.erros?.[0];
  return {
    code: error?.Codigo ?? error?.codigo,
    message: error?.Descricao ?? error?.descricao,
  };
}
