import { fromBER } from "asn1js";
import { Certificate, ContentInfo, SignedData } from "pkijs";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
import { HttpError } from "./api";
import { certificatePolicy, cryptoEngine, validateCertificate, type CertificatePolicy } from "./certificate-validation";

async function verifySignedPdf(bytes: Uint8Array, policy?: CertificatePolicy) {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); } catch { throw new HttpError(400, "O arquivo não é um PDF válido ou está protegido por senha."); }
  if (doc.isEncrypted) throw new HttpError(400, "O PDF não pode estar protegido por senha.");
  // Only signature dictionaries recognized by the PDF parser are accepted.
  const signatures = doc.context.enumerateIndirectObjects().map(([, object]) => object).filter(
    (object): object is PDFDict => object instanceof PDFDict && object.get(PDFName.of("Type"))?.toString() === "/Sig",
  );
  if (!signatures.length || signatures.length > 10) throw new HttpError(400, "O PDF não possui uma assinatura digital verificável.");
  for (const signature of signatures) {
    const range = signature.lookupMaybe(PDFName.of("ByteRange"), PDFArray);
    if (!range || range.size() !== 4) continue;
    const [zero, length, offset, remaining] = range.asArray().map((n) => n instanceof PDFNumber ? n.asNumber() : NaN);
    if (![zero, length, offset, remaining].every(Number.isSafeInteger) || zero !== 0 || length <= 0 || offset <= length || remaining < 0 || offset + remaining !== bytes.byteLength) continue;
    const gap = Buffer.from(bytes.subarray(length, offset)).toString("ascii");
    if (!/^<[\da-fA-F\s]+>$/.test(gap)) continue;
    const contents = signature.lookupMaybe(PDFName.of("Contents"), PDFHexString);
    if (!contents) continue;
    const raw = Buffer.from(gap.slice(1, -1).replace(/\s/g, ""), "hex");
    if (!raw.equals(Buffer.from(contents.asBytes()))) continue;
    const parsed = fromBER(Uint8Array.from(raw).buffer);
    if (parsed.offset === -1 || raw.subarray(parsed.offset).some((byte) => byte !== 0)) continue;
    const content = new ContentInfo({ schema: parsed.result });
    if (content.contentType !== ContentInfo.SIGNED_DATA) continue;
    const signed = new SignedData({ schema: content.content });
    if (signed.encapContentInfo.eContent) continue;
    const extra = (signed.certificates || []).filter((cert): cert is Certificate => cert instanceof Certificate);
    const data = Uint8Array.from(Buffer.concat([bytes.subarray(0, length), bytes.subarray(offset)])).buffer;
    for (let signer = 0; signer < signed.signerInfos.length; signer++) {
      if (!["2.16.840.1.101.3.4.2.1", "2.16.840.1.101.3.4.2.2", "2.16.840.1.101.3.4.2.3"].includes(signed.signerInfos[signer].digestAlgorithm.algorithmId)) continue;
      const result = await signed.verify({ signer, data, checkChain: false, extendedMode: true }, cryptoEngine()).catch(() => null);
      if (result?.signatureVerified && result.signerCertificate) {
        const certBytes = new Uint8Array(result.signerCertificate.toSchema().toBER(false));
        return validateCertificate(certBytes, extra, policy || certificatePolicy());
      }
    }
  }
  throw new HttpError(400, "Assinatura inválida, arquivo alterado após assinatura ou formato não suportado.");
}

export async function validateSignedPdf(bytes: Uint8Array, policy?: CertificatePolicy) {
  try { return await verifySignedPdf(bytes, policy); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Não foi possível validar a assinatura deste PDF. O arquivo pode estar corrompido ou usar um formato não suportado.");
  }
}
