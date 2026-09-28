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

  const cnpj = env("NFSE_CNPJ");
  const municipioIbge = env("NFSE_MUNICIPIO_IBGE");
  const inscricaoMunicipal = env("NFSE_INSCRICAO_MUNICIPAL");
  const apiBaseUrl = env("NFSE_API_BASE_URL");
  const certificatePath = env("NFSE_CERT_PFX_PATH");
  const certificatePassword = env("NFSE_CERT_PASSWORD");
  const codigoServico = env("NFSE_CODIGO_SERVICO");

  const required = [
    ["NFSE_CNPJ", cnpj],
    ["NFSE_MUNICIPIO_IBGE", municipioIbge],
    ["NFSE_API_BASE_URL", apiBaseUrl],
    ["NFSE_CERT_PFX_PATH", certificatePath],
    ["NFSE_CERT_PASSWORD", certificatePassword],
  ] as const;

  const missing = provider === "disabled" ? [] : required.filter(([, value]) => !value).map(([key]) => key);

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
    enabled: provider !== "disabled",
    ready: provider !== "disabled" && missing.length === 0,
    missing,
  };
}

export function nfsePublicReadiness() {
  const config = getNfseServerConfig();
  return {
    provider: config.provider,
    ambiente: config.ambiente,
    enabled: config.enabled,
    ready: config.ready,
    missing: config.missing,
    municipioConfigured: Boolean(config.municipioIbge),
    cnpjConfigured: Boolean(config.cnpj),
    certificateConfigured: Boolean(config.certificatePath && config.certificatePassword),
    apiConfigured: Boolean(config.apiBaseUrl),
    codigoServicoConfigured: Boolean(config.codigoServico),
    inscricaoMunicipalConfigured: Boolean(config.inscricaoMunicipal),
  };
}
