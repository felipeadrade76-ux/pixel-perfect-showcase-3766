import { expect, test } from "bun:test";
import {
  buildNfsePostBody,
  gunzipBase64Xml,
  gzipBase64Xml,
  nfseEndpoint,
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
