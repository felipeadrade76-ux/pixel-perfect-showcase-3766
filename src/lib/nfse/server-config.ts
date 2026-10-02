export type NfseProvider = "disabled" | "nacional" | "municipal";
export type NfseAmbiente = "homologacao" | "producao";

const providerValues = new Set<NfseProvider>(["disabled", "nacional", "municipal"]);
const ambienteValues = new Set<NfseAmbiente>(["homologacao", "producao"]);

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function inteiro(name: string): number | undefined {
  const value = env(name);
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
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
  const codigoServico = env("NFSE_CODIGO_SERVICO")?.replace(/\D/g, "");
  const codigoServicoMunicipal = env("NFSE_CODIGO_SERVICO_MUNICIPAL")?.replace(/\D/g, "");
  const serieDps = inteiro("NFSE_SERIE_DPS");
  const opcaoSimplesNacional = env("NFSE_OP_SIMP_NAC");
  const regimeApuracaoSimples = env("NFSE_REG_AP_TRIB_SN");
  const regimeEspecialTributacao = env("NFSE_REG_ESP_TRIB");
  const tributacaoIssqn = env("NFSE_TRIB_ISSQN");
  const retencaoIssqn = env("NFSE_TP_RET_ISSQN");
  const allowProduction = env("NFSE_ALLOW_PRODUCTION") === "yes";

  const required = [
    ["NFSE_CNPJ", cnpj],
    ["NFSE_MUNICIPIO_IBGE", municipioIbge],
    ["NFSE_CODIGO_SERVICO", codigoServico],
    ["NFSE_API_BASE_URL", apiBaseUrl],
    ["NFSE_CERT_PFX_PATH", certificatePath],
    ["NFSE_CERT_PASSWORD", certificatePassword],
    ["NFSE_SERIE_DPS", serieDps],
    ["NFSE_OP_SIMP_NAC", opcaoSimplesNacional],
    ["NFSE_REG_ESP_TRIB", regimeEspecialTributacao],
    ["NFSE_TRIB_ISSQN", tributacaoIssqn],
    ["NFSE_TP_RET_ISSQN", retencaoIssqn],
  ] as const;

  const missing: string[] =
    provider === "disabled" ? [] : required.filter(([, value]) => !value).map(([key]) => key);

  if (opcaoSimplesNacional === "3" && !regimeApuracaoSimples) {
    missing.push("NFSE_REG_AP_TRIB_SN");
  }

  if (provider === "municipal") {
    missing.push("NFSE_MUNICIPAL_ADAPTER");
  }

  const invalid: string[] = [];
  if (cnpj && !/^[A-Z0-9]{14}$/.test(cnpj)) invalid.push("NFSE_CNPJ");
  if (municipioIbge && !/^[0-9]{7}$/.test(municipioIbge)) invalid.push("NFSE_MUNICIPIO_IBGE");
  if (codigoServico && !/^[0-9]{6}$/.test(codigoServico)) invalid.push("NFSE_CODIGO_SERVICO");
  if (codigoServicoMunicipal && !/^[0-9]{3}$/.test(codigoServicoMunicipal)) {
    invalid.push("NFSE_CODIGO_SERVICO_MUNICIPAL");
  }
  if (!serieDps || serieDps < 1 || serieDps > 99999) invalid.push("NFSE_SERIE_DPS");
  if (opcaoSimplesNacional && !/^[123]$/.test(opcaoSimplesNacional)) {
    invalid.push("NFSE_OP_SIMP_NAC");
  }
  if (regimeEspecialTributacao && !/^\d+$/.test(regimeEspecialTributacao)) {
    invalid.push("NFSE_REG_ESP_TRIB");
  }
  if (tributacaoIssqn && !/^[1234]$/.test(tributacaoIssqn)) invalid.push("NFSE_TRIB_ISSQN");
  if (retencaoIssqn && !/^[123]$/.test(retencaoIssqn)) invalid.push("NFSE_TP_RET_ISSQN");

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
    codigoServicoMunicipal,
    serieDps,
    opcaoSimplesNacional,
    regimeApuracaoSimples,
    regimeEspecialTributacao,
    tributacaoIssqn,
    retencaoIssqn,
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
    serieDpsConfigured: Boolean(config.serieDps),
    regimeConfigured: Boolean(
      config.opcaoSimplesNacional &&
      config.regimeEspecialTributacao &&
      config.tributacaoIssqn &&
      config.retencaoIssqn,
    ),
  };
}
