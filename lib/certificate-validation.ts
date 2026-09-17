import { X509Certificate } from "node:crypto";
import { Certificate, CertificateChainValidationEngine, CertificateRevocationList, CryptoEngine } from "pkijs";
import { HttpError } from "./api";

export type CertificatePolicy = {
  roots: Certificate[];
  intermediates: Certificate[];
  crls: CertificateRevocationList[];
};

export function cryptoEngine() {
  return new CryptoEngine({ name: "webcrypto", crypto: globalThis.crypto });
}

function pemBlocks(value: string | undefined, label: string): ArrayBuffer[] {
  const pattern = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`, "g");
  return Array.from((value || "").replace(/\\n/g, "\n").matchAll(pattern), (match) =>
    Uint8Array.from(Buffer.from(match[1].replace(/\s/g, ""), "base64")).buffer,
  );
}

export function certificatePolicy(): CertificatePolicy {
  const roots = pemBlocks(process.env.SIGNATURE_TRUSTED_ROOTS_PEM, "CERTIFICATE").map((raw) => Certificate.fromBER(raw));
  if (!roots.length) throw new HttpError(503, "A validação de certificados ainda não foi configurada pelo administrador.");
  return {
    roots,
    intermediates: pemBlocks(process.env.SIGNATURE_INTERMEDIATES_PEM, "CERTIFICATE").map((raw) => Certificate.fromBER(raw)),
    crls: pemBlocks(process.env.SIGNATURE_CRLS_PEM, "X509 CRL").map((raw) => CertificateRevocationList.fromBER(raw)),
  };
}

export function certificateIdentity(raw: Uint8Array) {
  let cert: X509Certificate;
  try { cert = new X509Certificate(raw); } catch { throw new HttpError(400, "Certificado digital inválido."); }
  const now = Date.now();
  if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) {
    throw new HttpError(400, "O certificado está vencido ou ainda não está válido.");
  }
  if (cert.ca) throw new HttpError(400, "Use um certificado de pessoa, não de autoridade certificadora.");
  if (cert.publicKey.asymmetricKeyType !== "rsa" || (cert.publicKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
    throw new HttpError(400, "A assinatura direta exige certificado RSA com pelo menos 2048 bits.");
  }
  const subjectCommonName = cert.subject.match(/(?:^|\n)CN=([^\n]+)/)?.[1]?.trim();
  if (!subjectCommonName) throw new HttpError(400, "O certificado não identifica o titular.");
  return {
    subjectCommonName,
    subjectCpf: subjectCommonName.match(/:(\d{11})/)?.[1],
    issuer: cert.issuer,
    validFrom: new Date(cert.validFrom),
    validTo: new Date(cert.validTo),
    rawSerial: cert.serialNumber,
    fingerprint: cert.fingerprint256,
  };
}

export async function validateCertificate(raw: Uint8Array, extraCerts: Certificate[] = [], policy = certificatePolicy()) {
  const identity = certificateIdentity(raw);
  const leaf = Certificate.fromBER(Uint8Array.from(raw).buffer);
  const chain = new CertificateChainValidationEngine({
    trustedCerts: policy.roots,
    certs: [...policy.intermediates, ...extraCerts, leaf],
    crls: policy.crls,
    checkDate: new Date(),
  });
  // Fail closed when up-to-date revocation information is unavailable.
  const result = await chain.verify({ passedWhenNotRevValues: false }, cryptoEngine());
  if (!result.result) throw new HttpError(400, "Não foi possível validar a cadeia e a situação de revogação do certificado. Verifique as autoridades e LCRs configuradas.");
  const path = result.certificatePath || [];
  if (!path.length) throw new HttpError(400, "Cadeia de certificação não encontrada.");
  const now = Date.now();
  for (const certificate of path) {
    if (policy.roots.some((root) => Buffer.from(root.toSchema().toBER(false)).equals(Buffer.from(certificate.toSchema().toBER(false))))) continue;
    const issuers = path.filter((issuer) => certificate.issuer.isEqual(issuer.subject));
    let checked = false;
    for (const crl of policy.crls) {
      if (!crl.issuer.isEqual(certificate.issuer) || crl.thisUpdate.value.getTime() > now || !crl.nextUpdate || crl.nextUpdate.value.getTime() <= now) continue;
      // Scoped, indirect and delta CRLs require processing beyond this validator.
      if (crl.crlExtensions?.extensions.some((extension) => ["2.5.29.27", "2.5.29.28"].includes(extension.extnID))) continue;
      for (const issuer of issuers) {
        if (!await crl.verify({ issuerCertificate: issuer }, cryptoEngine())) continue;
        checked = true;
        if (crl.isCertificateRevoked(certificate)) throw new HttpError(400, "O certificado consta na lista de revogação.");
      }
    }
    if (!checked) throw new HttpError(400, "Não há uma lista de revogação válida e atualizada para a cadeia do certificado.");
  }
  return identity;
}
