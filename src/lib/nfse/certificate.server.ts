import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CERT_OUTPUT = 2 * 1024 * 1024;

function findPem(output: string, label: "PRIVATE KEY" | "CERTIFICATE"): string {
  const re =
    label === "PRIVATE KEY"
      ? /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/
      : /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;
  const match = output.match(re)?.[0];
  if (!match) {
    throw new Error(
      `PKCS#12 não contém ${label === "PRIVATE KEY" ? "chave privada" : "certificado"} utilizável.`,
    );
  }
  return match;
}

export async function extractSigningMaterial(
  pfxPath: string,
  password: string,
): Promise<{ privateKeyPem: string; certificatePem: string }> {
  const env = { ...process.env, RITMEIA_PFX_PASSWORD: password };
  const common = ["pkcs12", "-in", pfxPath, "-passin", "env:RITMEIA_PFX_PASSWORD"];

  const [keyResult, certResult] = await Promise.all([
    execFileAsync("openssl", [...common, "-nodes", "-nocerts"], {
      env,
      maxBuffer: MAX_CERT_OUTPUT,
    }),
    execFileAsync("openssl", [...common, "-clcerts", "-nokeys"], {
      env,
      maxBuffer: MAX_CERT_OUTPUT,
    }),
  ]);

  return {
    privateKeyPem: findPem(keyResult.stdout, "PRIVATE KEY"),
    certificatePem: findPem(certResult.stdout, "CERTIFICATE"),
  };
}
