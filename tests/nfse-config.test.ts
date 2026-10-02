import { afterEach, expect, test } from "bun:test";
import { getNfseServerConfig } from "../src/lib/nfse/server-config";

const KEYS = [
  "NFSE_PROVIDER",
  "NFSE_AMBIENTE",
  "NFSE_CNPJ",
  "NFSE_MUNICIPIO_IBGE",
  "NFSE_INSCRICAO_MUNICIPAL",
  "NFSE_CODIGO_SERVICO",
  "NFSE_CODIGO_SERVICO_MUNICIPAL",
  "NFSE_SERIE_DPS",
  "NFSE_OP_SIMP_NAC",
  "NFSE_REG_AP_TRIB_SN",
  "NFSE_REG_ESP_TRIB",
  "NFSE_TRIB_ISSQN",
  "NFSE_TP_RET_ISSQN",
  "NFSE_API_BASE_URL",
  "NFSE_CERT_PFX_PATH",
  "NFSE_CERT_PASSWORD",
  "NFSE_ALLOW_PRODUCTION",
] as const;

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clear() {
  for (const key of KEYS) delete process.env[key];
}

function validHomologation() {
  process.env.NFSE_PROVIDER = "nacional";
  process.env.NFSE_AMBIENTE = "homologacao";
  process.env.NFSE_CNPJ = "12ABC34501DE35";
  process.env.NFSE_MUNICIPIO_IBGE = "3100000";
  process.env.NFSE_CODIGO_SERVICO = "010701";
  process.env.NFSE_SERIE_DPS = "1601";
  process.env.NFSE_OP_SIMP_NAC = "1";
  process.env.NFSE_REG_ESP_TRIB = "0";
  process.env.NFSE_TRIB_ISSQN = "1";
  process.env.NFSE_TP_RET_ISSQN = "1";
  process.env.NFSE_API_BASE_URL = "https://homologacao.example.gov.br";
  process.env.NFSE_CERT_PFX_PATH = "/run/secrets/nfse.pfx";
  process.env.NFSE_CERT_PASSWORD = "server-only";
}

test("NFS-e stays disabled by default", () => {
  clear();
  const config = getNfseServerConfig();
  expect(config.enabled).toBe(false);
  expect(config.ready).toBe(false);
  expect(config.missing).toEqual([]);
});

test("NFS-e reports missing server configuration without exposing secret values", () => {
  clear();
  process.env.NFSE_PROVIDER = "nacional";
  const config = getNfseServerConfig();
  expect(config.ready).toBe(false);
  expect(config.missing).toContain("NFSE_CERT_PASSWORD");
  expect(config.certificatePassword).toBeUndefined();
});

test("homologation becomes ready only with valid HTTPS and fiscal identifiers", () => {
  clear();
  validHomologation();
  const config = getNfseServerConfig();
  expect(config.ready).toBe(true);
  expect(config.invalid).toEqual([]);
  expect(config.productionBlocked).toBe(false);
  expect(config.cnpj).toBe("12ABC34501DE35");
});

test("production requires a deliberate server-side unlock", () => {
  clear();
  validHomologation();
  process.env.NFSE_AMBIENTE = "producao";

  expect(getNfseServerConfig().ready).toBe(false);
  expect(getNfseServerConfig().productionBlocked).toBe(true);

  process.env.NFSE_ALLOW_PRODUCTION = "yes";
  expect(getNfseServerConfig().ready).toBe(true);
  expect(getNfseServerConfig().productionBlocked).toBe(false);
});

test("invalid municipality or non-HTTPS API cannot become ready", () => {
  clear();
  validHomologation();
  process.env.NFSE_MUNICIPIO_IBGE = "123";
  process.env.NFSE_API_BASE_URL = "http://unsafe.example.com";
  const config = getNfseServerConfig();
  expect(config.ready).toBe(false);
  expect(config.invalid).toContain("NFSE_MUNICIPIO_IBGE");
  expect(config.invalid).toContain("NFSE_API_BASE_URL");
});

test("municipal provider stays blocked until a concrete adapter exists", () => {
  clear();
  validHomologation();
  process.env.NFSE_PROVIDER = "municipal";
  const config = getNfseServerConfig();
  expect(config.enabled).toBe(true);
  expect(config.supported).toBe(false);
  expect(config.ready).toBe(false);
  expect(config.missing).toContain("NFSE_MUNICIPAL_ADAPTER");
});


test("Simples Nacional profile 3 requires its assessment regime", () => {
  clear();
  validHomologation();
  process.env.NFSE_OP_SIMP_NAC = "3";
  expect(getNfseServerConfig().ready).toBe(false);
  expect(getNfseServerConfig().missing).toContain("NFSE_REG_AP_TRIB_SN");

  process.env.NFSE_REG_AP_TRIB_SN = "1";
  expect(getNfseServerConfig().ready).toBe(true);
});

test("service code and DPS series are validated before readiness", () => {
  clear();
  validHomologation();
  process.env.NFSE_CODIGO_SERVICO = "1401";
  process.env.NFSE_SERIE_DPS = "0";
  const config = getNfseServerConfig();
  expect(config.ready).toBe(false);
  expect(config.invalid).toContain("NFSE_CODIGO_SERVICO");
  expect(config.invalid).toContain("NFSE_SERIE_DPS");
});
