import { expect, test } from "bun:test";
import {
  buildNfsePostBody,
  gunzipBase64Xml,
  gzipBase64Xml,
  nfseEndpoint,
  parseNfseResponse,
} from "../src/lib/nfse/nacional-transport";

test("NFS-e DPS XML gzip/base64 round-trips without mutation", () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><DPS><infDPS Id="DPS1"/></DPS>';
  const encoded = gzipBase64Xml(xml);
  expect(encoded.length).toBeGreaterThan(10);
  expect(gunzipBase64Xml(encoded)).toBe(xml);
  expect(buildNfsePostBody(xml)).toEqual({ dpsXmlGZipB64: encoded });
});

test("NFS-e endpoint appends /nfse to a configured HTTPS API base", () => {
  expect(nfseEndpoint("https://example.gov.br/SefinNacional").toString()).toBe(
    "https://example.gov.br/SefinNacional/nfse",
  );
});

test("NFS-e endpoint rejects non-HTTPS configuration", () => {
  expect(() => nfseEndpoint("http://example.gov.br/SefinNacional")).toThrow("HTTPS");
});

test("NFS-e gzip decoder rejects invalid data", () => {
  expect(() => gunzipBase64Xml("not-gzip")).toThrow("compactado inválido");
});

test("parses a successful National NFS-e response and decodes its XML", () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><NFSe Id="NFS1"/>';
  const raw = JSON.stringify({
    tipoAmbiente: 2,
    versaoAplicativo: "test",
    dataHoraProcessamento: "2026-10-01T12:00:00-03:00",
    idDps: "DPS1",
    chaveAcesso: "1".repeat(50),
    nfseXmlGZipB64: gzipBase64Xml(xml),
  });
  const parsed = parseNfseResponse(201, raw);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.data.chaveAcesso).toBe("1".repeat(50));
    expect(parsed.xml).toBe(xml);
  }
});

test("treats business rejection as non-retryable and preserves error payload", () => {
  const parsed = parseNfseResponse(
    400,
    JSON.stringify({ erros: [{ Codigo: "E0001", Descricao: "DPS rejeitada" }] }),
  );
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.retryable).toBe(false);
    expect(parsed.data?.erros?.[0]?.Codigo).toBe("E0001");
  }
});

test("treats timeout/rate-limit/server responses as retryable", () => {
  for (const status of [408, 429, 500, 503]) {
    const parsed = parseNfseResponse(status, "{}");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.retryable).toBe(true);
  }
});
