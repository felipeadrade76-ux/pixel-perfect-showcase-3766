export type NfseProvider = "disabled" | "nacional" | "municipal";
export type NfseAmbiente = "homologacao" | "producao";

const providerValues = new Set<NfseProvider>(["disabled", "nacional", "municipal"]);
const ambienteValues = new Set<NfseAmbiente>(["homologacao", "producao"]);

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getNfseServerConfig() {
  const rawProvider = env("NFSE_PROVIDER") ?? "disabled";
  const provider: NfseProvider = providerValues.has(rawProvider as NfseProvider)
    ? (rawProvider as NfseProvider)
    : "disabled";

  const rawAmbiente = env("NFSE_AMBIENTE") ?? "homologacao";
  const ambiente: NfseAmbiente = ambienteValues.has(rawAmbiente as NfseAmbiente)
    ? (rawAmbiente as NfseAmbiente)
    : "homologacao";

  const cnpj = env("NFSE_CNPJ")
    ?.toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const municipioIbge = env("NFSE_MUNICIPIO_IBGE")?.replace(/\D/g, "");
  const inscricaoMunicipal = env("NFSE_INSCRICAO_MUNICIPAL");
  const apiBaseUrl = env("NFSE_API_BASE_URL");
  const certificatePath = env("NFSE_CERT_PFX_PATH");
  const certificatePassword = env("NFSE_CERT_PASSWORD");
  const codigoServico = env("NFSE_CODIGO_SERVICO");
  const allowProduction = env("NFSE_ALLOW_PRODUCTION") === "yes";

  const required = [
    ["NFSE_CNPJ", cnpj],
    ["NFSE_MUNICIPIO_IBGE", municipioIbge],
    ["NFSE_CODIGO_SERVICO", codigoServico],
    ["NFSE_API_BASE_URL", apiBaseUrl],
    ["NFSE_CERT_PFX_PATH", certificatePath],
    ["NFSE_CERT_PASSWORD", certificatePassword],
  ] as const;

  const missing: string[] =
    provider === "disabled" ? [] : required.filter(([, value]) => !value).map(([key]) => key);

  if (provider === "municipal") {
    missing.push("NFSE_MUNICIPAL_ADAPTER");
  }

  const invalid: string[] = [];
  if (cnpj && !/^[A-Z0-9]{14}$/.test(cnpj)) invalid.push("NFSE_CNPJ");
  if (municipioIbge && !/^[0-9]{7}$/.test(municipioIbge)) invalid.push("NFSE_MUNICIPIO_IBGE");
  if (apiBaseUrl) {
    try {
      const parsed = new URL(apiBaseUrl);
      if (parsed.protocol !== "https:") invalid.push("NFSE_API_BASE_URL");
    } catch {
      invalid.push("NFSE_API_BASE_URL");
    }
  }

  const productionBlocked = ambiente === "producao" && !allowProduction;
  const enabled = provider !== "disabled";
  const supported = provider === "nacional";
  const ready =
    enabled && supported && missing.length === 0 && invalid.length === 0 && !productionBlocked;

  return {
    provider,
    ambiente,
    cnpj,
    municipioIbge,
    inscricaoMunicipal,
    apiBaseUrl,
    certificatePath,
    certificatePassword,
    codigoServico,
    allowProduction,
    productionBlocked,
    enabled,
    supported,
    ready,
    missing,
    invalid,
  };
}

export function nfsePublicReadiness() {
  const config = getNfseServerConfig();
  return {
    provider: config.provider,
    ambiente: config.ambiente,
    enabled: config.enabled,
    supported: config.supported,
    ready: config.ready,
    missing: config.missing,
    invalid: config.invalid,
    productionBlocked: config.productionBlocked,
    municipioConfigured: Boolean(config.municipioIbge),
    cnpjConfigured: Boolean(config.cnpj),
    certificateConfigured: Boolean(config.certificatePath && config.certificatePassword),
    apiConfigured: Boolean(config.apiBaseUrl),
    codigoServicoConfigured: Boolean(config.codigoServico),
    inscricaoMunicipalConfigured: Boolean(config.inscricaoMunicipal),
  };
}
