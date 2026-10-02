import { generateKeyPairSync } from "node:crypto";
import { expect, test } from "bun:test";
import {
  buildDpsId,
  buildInfDps,
  signDpsXml,
  type DpsFiscalProfile,
  type DpsSnapshot,
} from "../src/lib/nfse/dps-xml";

const profile: DpsFiscalProfile = {
  ambiente: "homologacao",
  cnpj: "12ABC34501DE35",
  inscricaoMunicipal: "12345",
  municipioIbge: "3170404",
  serieDps: 1601,
  codigoServico: "010701",
  opcaoSimplesNacional: "1",
  regimeEspecialTributacao: "0",
  tributacaoIssqn: "1",
  retencaoIssqn: "1",
};

const snapshot: DpsSnapshot = {
  numeroDps: 42,
  valorServicos: 150,
  tomador: {
    nome: "Cliente & Teste",
    documento: "12345678909",
    email: "cliente@example.com",
  },
  descricaoServico: "Manutenção <completa>",
  emitidaEm: "2026-10-01T12:00:00Z",
  competencia: "2026-10-01",
};

test("builds the National DPS id with municipality, CNPJ, series and sequence", () => {
  const id = buildDpsId(profile, 42);
  expect(id).toBe("DPS3170404212ABC34501DE3501601000000000000042");
  expect(id).toHaveLength(45);
});

test("serializes a minimal v1.01 DPS snapshot in deterministic order", () => {
  const inf = buildInfDps(profile, snapshot);
  expect(inf.xml).toContain('<infDPS Id="DPS3170404212ABC34501DE3501601000000000000042">');
  expect(inf.xml).toContain("<tpAmb>2</tpAmb>");
  expect(inf.xml).toContain("<cTribNac>010701</cTribNac>");
  expect(inf.xml).toContain("<vServ>150.00</vServ>");
  expect(inf.xml).toContain("<xNome>Cliente &amp; Teste</xNome>");
  expect(inf.xml).toContain("<xDescServ>Manutenção &lt;completa&gt;</xDescServ>");
  expect(inf.xml).toContain("<indTotTrib>0</indTotTrib>");
});

test("signs the DPS information element and embeds an X509 certificate", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const certificatePem = "-----BEGIN CERTIFICATE-----\nQUJDREVGRw==\n-----END CERTIFICATE-----";

  const signed = signDpsXml(profile, snapshot, privateKeyPem, certificatePem);
  expect(signed.id).toBe(buildDpsId(profile, 42));
  expect(signed.xml).toContain('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">');
  expect(signed.xml).toContain('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
  expect(signed.xml).toContain("<DigestValue>");
  expect(signed.xml).toContain("<SignatureValue>");
  expect(signed.xml).toContain("<X509Certificate>QUJDREVGRw==</X509Certificate>");
});

test("rejects invalid fiscal identifiers before creating XML", () => {
  expect(() => buildDpsId({ ...profile, municipioIbge: "123" }, 1)).toThrow("Município");
  expect(() => buildDpsId({ ...profile, cnpj: "123" }, 1)).toThrow("CNPJ");
  expect(() => buildDpsId(profile, 0)).toThrow("Número DPS");
});
