import { createHash, createSign } from "node:crypto";

const NFSE_NS = "http://www.sped.fazenda.gov.br/nfse";
const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";

export type DpsFiscalProfile = {
  ambiente: "homologacao" | "producao";
  cnpj: string;
  inscricaoMunicipal?: string | undefined;
  municipioIbge: string;
  serieDps: number;
  codigoServico: string;
  codigoServicoMunicipal?: string | undefined;
  opcaoSimplesNacional: string;
  regimeApuracaoSimples?: string | undefined;
  regimeEspecialTributacao: string;
  tributacaoIssqn: string;
  retencaoIssqn: string;
};

export type DpsSnapshot = {
  numeroDps: number;
  valorServicos: number;
  tomador: {
    nome: string;
    documento: string;
    email?: string | undefined;
    telefone?: string | undefined;
  };
  descricaoServico: string;
  competencia?: string | undefined;
  emitidaEm?: string | undefined;
};

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function tag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === "") return "";
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

function money(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Valor de serviço inválido.");
  return value.toFixed(2);
}

function isoNoMillis(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Data de emissão inválida.");
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function dateOnly(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Data de competência inválida.");
  return date.toISOString().slice(0, 10);
}

export function buildDpsId(profile: DpsFiscalProfile, numeroDps: number): string {
  const federal = profile.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{14}$/.test(federal)) throw new Error("CNPJ do prestador inválido.");
  if (!/^\d{7}$/.test(profile.municipioIbge)) throw new Error("Município IBGE inválido.");
  if (!Number.isInteger(profile.serieDps) || profile.serieDps < 1 || profile.serieDps > 99999) {
    throw new Error("Série DPS inválida.");
  }
  if (!Number.isInteger(numeroDps) || numeroDps < 1 || numeroDps > 999999999999999) {
    throw new Error("Número DPS inválido.");
  }
  return (
    "DPS" +
    profile.municipioIbge +
    "2" +
    federal +
    String(profile.serieDps).padStart(5, "0") +
    String(numeroDps).padStart(15, "0")
  );
}

function tomadorXml(snapshot: DpsSnapshot): string {
  const documento = snapshot.tomador.documento.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let documentoXml = "";
  if (/^\d{11}$/.test(documento)) documentoXml = tag("CPF", documento);
  else if (/^[A-Z0-9]{14}$/.test(documento)) documentoXml = tag("CNPJ", documento);
  else throw new Error("CPF/CNPJ do tomador inválido.");

  return (
    "<toma>" +
    documentoXml +
    tag("xNome", snapshot.tomador.nome.trim()) +
    tag("fone", snapshot.tomador.telefone?.replace(/\D/g, "")) +
    tag("email", snapshot.tomador.email?.trim()) +
    "</toma>"
  );
}

export function buildInfDps(profile: DpsFiscalProfile, snapshot: DpsSnapshot) {
  const id = buildDpsId(profile, snapshot.numeroDps);
  const ambiente = profile.ambiente === "producao" ? "1" : "2";
  const regAp =
    profile.opcaoSimplesNacional === "3"
      ? tag("regApTribSN", profile.regimeApuracaoSimples)
      : "";

  const prest =
    "<prest>" +
    tag("CNPJ", profile.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, "")) +
    tag("IM", profile.inscricaoMunicipal) +
    "<regTrib>" +
    tag("opSimpNac", profile.opcaoSimplesNacional) +
    regAp +
    tag("regEspTrib", profile.regimeEspecialTributacao) +
    "</regTrib>" +
    "</prest>";

  const serv =
    "<serv>" +
    "<locPrest>" +
    tag("cLocPrestacao", profile.municipioIbge) +
    "</locPrest>" +
    "<cServ>" +
    tag("cTribNac", profile.codigoServico) +
    tag("cTribMun", profile.codigoServicoMunicipal) +
    tag("xDescServ", snapshot.descricaoServico.trim()) +
    "</cServ>" +
    "</serv>";

  const valores =
    "<valores>" +
    "<vServPrest>" +
    tag("vServ", money(snapshot.valorServicos)) +
    "</vServPrest>" +
    "<trib>" +
    "<tribMun>" +
    tag("tribISSQN", profile.tributacaoIssqn) +
    tag("tpRetISSQN", profile.retencaoIssqn) +
    "</tribMun>" +
    "<totTrib><indTotTrib>0</indTotTrib></totTrib>" +
    "</trib>" +
    "</valores>";

  const inner =
    tag("tpAmb", ambiente) +
    tag("dhEmi", isoNoMillis(snapshot.emitidaEm)) +
    tag("verAplic", "Ritmeia_1.0") +
    tag("serie", profile.serieDps) +
    tag("nDPS", snapshot.numeroDps) +
    tag("dCompet", snapshot.competencia ?? dateOnly(snapshot.emitidaEm)) +
    tag("tpEmit", "1") +
    tag("cLocEmi", profile.municipioIbge) +
    prest +
    tomadorXml(snapshot) +
    serv +
    valores;

  return {
    id,
    xml: `<infDPS Id="${id}">${inner}</infDPS>`,
    canonical: `<infDPS xmlns="${NFSE_NS}" Id="${id}">${inner}</infDPS>`,
  };
}

function certificateBase64(certificatePem: string): string {
  const match = certificatePem.match(
    /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/,
  );
  if (!match?.[1]) throw new Error("Certificado X509 inválido.");
  return match[1].replace(/\s+/g, "");
}

export function signDpsXml(
  profile: DpsFiscalProfile,
  snapshot: DpsSnapshot,
  privateKeyPem: string,
  certificatePem: string,
): { id: string; xml: string } {
  const inf = buildInfDps(profile, snapshot);
  const digest = createHash("sha1").update(inf.canonical, "utf8").digest("base64");

  const signedInfoInner =
    `<CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${RSA_SHA1}"></SignatureMethod>` +
    `<Reference URI="#${inf.id}">` +
    "<Transforms>" +
    `<Transform Algorithm="${ENVELOPED}"></Transform>` +
    `<Transform Algorithm="${C14N}"></Transform>` +
    "</Transforms>" +
    `<DigestMethod Algorithm="${SHA1}"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue>` +
    "</Reference>";

  const canonicalSignedInfo = `<SignedInfo xmlns="${DS_NS}">${signedInfoInner}</SignedInfo>`;
  const signer = createSign("RSA-SHA1");
  signer.update(canonicalSignedInfo, "utf8");
  signer.end();
  const signatureValue = signer.sign(privateKeyPem, "base64");

  const signature =
    `<Signature xmlns="${DS_NS}">` +
    `<SignedInfo>${signedInfoInner}</SignedInfo>` +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    "<KeyInfo><X509Data>" +
    `<X509Certificate>${certificateBase64(certificatePem)}</X509Certificate>` +
    "</X509Data></KeyInfo>" +
    "</Signature>";

  return {
    id: inf.id,
    xml:
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<DPS xmlns="${NFSE_NS}" versao="1.01">` +
      inf.xml +
      signature +
      "</DPS>",
  };
}
