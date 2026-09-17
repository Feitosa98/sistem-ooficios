import crypto from "node:crypto";
import {
  PDFArray,
  PDFDocument,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
} from "pdf-lib";
import { Certificate, IssuerAndSerialNumber } from "pkijs";
import { certificateIdentity, certificatePolicy } from "./certificate-validation";
import { HttpError } from "./api";
export { getPkiConfig, savePkiConfig } from "./pki-config";

// OIDs padrão ICP-Brasil / PKCS#7 / CMS
const OID_PKCS7_DATA = "1.2.840.113549.1.7.1";
const OID_PKCS7_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
const OID_SIGNING_TIME = "1.2.840.113549.1.9.5";
const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47";
const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_RSA_ENCRYPTION = "1.2.840.113549.1.1.1";

// Tamanho reservado para o contêiner PKCS#7 no PDF (em bytes)
// 16384 bytes = 32768 caracteres hexadecimais, suficiente para cadeia ICP-Brasil completa com ACs intermediárias e raiz
const SIGNATURE_RESERVED_BYTES = 16384;

// ASN.1 DER Helper Functions
function derLength(len: number): Uint8Array {
  if (len < 128) {
    return new Uint8Array([len]);
  }
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp = temp >> 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Uint8Array): Uint8Array {
  const len = derLength(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}

function derSequence(items: Uint8Array[]): Uint8Array {
  const total = items.reduce((acc, curr) => acc + curr.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of items) {
    buf.set(item, offset);
    offset += item.length;
  }
  return derTag(0x30, buf);
}

function derSet(items: Uint8Array[], sort = true): Uint8Array {
  let sortedItems = items;
  if (sort) {
    sortedItems = [...items].sort((a, b) => {
      const minLen = Math.min(a.length, b.length);
      for (let i = 0; i < minLen; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return a.length - b.length;
    });
  }
  const total = sortedItems.reduce((acc, curr) => acc + curr.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of sortedItems) {
    buf.set(item, offset);
    offset += item.length;
  }
  return derTag(0x31, buf);
}

function derInteger(num: number | Uint8Array): Uint8Array {
  if (typeof num === "number") {
    if (num < 128) return new Uint8Array([0x02, 0x01, num]);
    const bytes: number[] = [];
    let temp = num;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    if (bytes[0] >= 0x80) bytes.unshift(0x00);
    return derTag(0x02, new Uint8Array(bytes));
  }
  // Raw integer bytes
  let bytes = num;
  if (bytes[0] >= 0x80) {
    const padded = new Uint8Array(bytes.length + 1);
    padded[0] = 0x00;
    padded.set(bytes, 1);
    bytes = padded;
  }
  return derTag(0x02, bytes);
}

function derOctetString(bytes: Uint8Array): Uint8Array {
  return derTag(0x04, bytes);
}

function derNull(): Uint8Array {
  return new Uint8Array([0x05, 0x00]);
}

function encodeOid(oidStr: string): Uint8Array {
  const parts = oidStr.split(".").map(Number);
  const bytes: number[] = [];
  bytes.push(parts[0] * 40 + parts[1]);
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) {
      bytes.push(val);
    } else {
      const vbytes: number[] = [];
      vbytes.push(val & 0x7f);
      val = val >> 7;
      while (val > 0) {
        vbytes.unshift((val & 0x7f) | 0x80);
        val = val >> 7;
      }
      bytes.push(...vbytes);
    }
  }
  return derTag(0x06, new Uint8Array(bytes));
}

function derUtcTime(date: Date): Uint8Array {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(2);
  const str = `${year}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  return derTag(0x17, new TextEncoder().encode(str));
}

// Extrai informações do certificado X.509 em formato DER
export const parseCertificateInfo = certificateIdentity;

function extractIssuerAndSerial(certDer: Uint8Array): Uint8Array {
  const cert = Certificate.fromBER(Uint8Array.from(certDer).buffer);
  return new Uint8Array(new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }).toSchema().toBER(false));
}

// Constrói os Atributos Assinados (SignedAttributes) do PAdES / CAdES
function buildSignedAttributes(pdfSha256Digest: Uint8Array, signerCertDer: Uint8Array, signingDate: Date) {
  // 1. ContentType
  const attrContentType = derSequence([
    encodeOid(OID_CONTENT_TYPE),
    derSet([encodeOid(OID_PKCS7_DATA)]),
  ]);

  // 2. SigningTime
  const attrSigningTime = derSequence([
    encodeOid(OID_SIGNING_TIME),
    derSet([derUtcTime(signingDate)]),
  ]);

  // 3. MessageDigest
  const attrMessageDigest = derSequence([
    encodeOid(OID_MESSAGE_DIGEST),
    derSet([derOctetString(pdfSha256Digest)]),
  ]);

  // 4. SigningCertificateV2 (hash SHA-256 do certificado do assinante)
  const certHash = crypto.createHash("sha256").update(signerCertDer).digest();
  const essCertIdV2 = derSequence([
    derSequence([encodeOid(OID_SHA256)]), // hashAlgorithm (SHA-256)
    derOctetString(certHash),             // certHash
  ]);
  const signingCertV2 = derSequence([
    derSequence([essCertIdV2]), // certs SEQUENCE OF ESSCertIDv2
  ]);
  const attrSigningCertV2 = derSequence([
    encodeOid(OID_SIGNING_CERTIFICATE_V2),
    derSet([signingCertV2]),
  ]);

  // Monta o SET ordenado de atributos assinados
  return derSet([attrContentType, attrSigningTime, attrMessageDigest, attrSigningCertV2], true);
}

// Dados da sessão persistida no D1/R2, com validade de dez minutos.
export type PendingSignatureSession = {
  id: number;
  preparedPdf: Uint8Array;
  byteRange: [number, number, number, number];
  contentsOffset: number;
  contentsLength: number;
  toSignHash: string;
  signedAttributesDer: Uint8Array;
  signerCertDer: Uint8Array;
  signingDate: Date;
  expiresAt: number;
};

/**
 * 1ª Etapa: Prepara o PDF inserindo o dicionário de assinatura PAdES e calcula o hash a ser assinado.
 */
export async function preparePdfForSignature(
  rawPdfBytes: Uint8Array,
  letterId: number,
  signerCertDer: Uint8Array,
  metadata: { reason?: string; location?: string; signerName?: string } = {}
) {
  const pdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1] || pdfDoc.addPage([595.28, 841.89]);

  const signingDate = new Date();
  const certInfo = parseCertificateInfo(signerCertDer);
  const signerDisplay = metadata.signerName || certInfo.subjectCommonName;

  // Preenche placeholder do ByteRange com 10 dígitos cada
  const byteRangePlaceholderArray = PDFArray.withContext(pdfDoc.context);
  byteRangePlaceholderArray.push(PDFNumber.of(0));
  byteRangePlaceholderArray.push(PDFNumber.of(1000000000));
  byteRangePlaceholderArray.push(PDFNumber.of(1000000000));
  byteRangePlaceholderArray.push(PDFNumber.of(1000000000));

  // Criação do dicionário de assinatura no PDF (ISO 32000-1 / DOC-ICP-15 PAdES)
  const signatureDict = pdfDoc.context.obj({
    Type: PDFName.of("Sig"),
    Filter: PDFName.of("Adobe.PPKLite"),
    SubFilter: PDFName.of("ETSI.CAdES.detached"),
    ByteRange: byteRangePlaceholderArray,
    Contents: PDFHexString.of("0".repeat(SIGNATURE_RESERVED_BYTES * 2)),
    Reason: PDFString.of(metadata.reason || "Assinatura Digital de Ofício Institucional"),
    Location: PDFString.of(metadata.location || "2º Ofício de Manacapuru/AM"),
    Name: PDFString.of(signerDisplay),
    M: PDFString.of(
      `D:${signingDate.getUTCFullYear()}${String(signingDate.getUTCMonth() + 1).padStart(2, "0")}${String(signingDate.getUTCDate()).padStart(2, "0")}${String(signingDate.getUTCHours()).padStart(2, "0")}${String(signingDate.getUTCMinutes()).padStart(2, "0")}${String(signingDate.getUTCSeconds()).padStart(2, "0")}Z`
    ),
  });

  const signatureDictRef = pdfDoc.context.register(signatureDict);

  // Registra o widget no AcroForm (invisível no canvas do PDF para evitar que leitores desenhem DN raw sobre o carimbo oficial)
  const widgetDict = pdfDoc.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Widget"),
    FT: PDFName.of("Sig"),
    T: PDFString.of(`Signature_${Date.now()}`),
    V: signatureDictRef,
    P: lastPage.ref,
    Rect: [0, 0, 0, 0],
    F: 4, // Print
  });
  const widgetRef = pdfDoc.context.register(widgetDict);

  // Adiciona ao catálogo AcroForm
  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"));
  if (!acroForm) {
    const newAcroForm = pdfDoc.context.obj({
      Fields: [widgetRef],
      SigFlags: PDFNumber.of(3), // SignaturesExist | AppendOnly
    });
    pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(newAcroForm));
  } else {
    const afDict = acroForm instanceof PDFDict ? acroForm : undefined;
    if (afDict && typeof afDict.set === "function") {
      afDict.set(PDFName.of("SigFlags"), PDFNumber.of(3));
      const fields = afDict.get(PDFName.of("Fields"));
      if (fields instanceof PDFArray) {
        fields.push(widgetRef);
      } else {
        afDict.set(PDFName.of("Fields"), PDFArray.withContext(pdfDoc.context));
      }
    }
  }

  // Salva o PDF com a reserva de espaço
  const savedPdf = await pdfDoc.save({ useObjectStreams: false });

  // Localiza os marcadores no PDF gerado
  const pdfBuffer = Buffer.from(savedPdf);
  const contentsMarker = Buffer.from("/Contents <");
  const contentsIndex = pdfBuffer.indexOf(contentsMarker);
  if (contentsIndex === -1) {
    throw new Error("Erro interno: placeholder de assinatura não localizado no documento PDF.");
  }

  const contentsStart = contentsIndex + contentsMarker.length - 1; // índice do '<'
  const contentsEnd = contentsStart + 1 + SIGNATURE_RESERVED_BYTES * 2; // índice do '>'

  if (pdfBuffer[contentsEnd] !== 0x3e /* '>' */) {
    throw new Error("Estrutura do placeholder /Contents corrompida.");
  }

  // Localiza o /ByteRange no buffer
  const byteRangeMarker = Buffer.from("/ByteRange [ 0 1000000000 1000000000 1000000000 ]");
  let byteRangeIndex = pdfBuffer.indexOf(byteRangeMarker);
  if (byteRangeIndex === -1) {
    const fallbackMarker = Buffer.from("/ByteRange [");
    byteRangeIndex = pdfBuffer.indexOf(fallbackMarker);
  }
  if (byteRangeIndex === -1) {
    throw new Error("Marcador /ByteRange não localizado no PDF.");
  }

  // Calcula o ByteRange exato:
  // [0, antes_do_conteudo, depois_do_conteudo, tamanho_restante]
  const offset1 = 0;
  const len1 = contentsStart;
  const offset2 = contentsEnd + 1;
  const len2 = pdfBuffer.length - offset2;

  const actualByteRange: [number, number, number, number] = [offset1, len1, offset2, len2];

  // Substitui a string /ByteRange [ ... ] mantendo exatamente os 49 bytes
  const byteRangeStr = `/ByteRange [ 0 ${String(actualByteRange[1]).padStart(10, "0")} ${String(actualByteRange[2]).padStart(10, "0")} ${String(actualByteRange[3]).padStart(10, "0")} ]`;
  const byteRangeBuffer = Buffer.from(byteRangeStr);
  byteRangeBuffer.copy(pdfBuffer, byteRangeIndex);

  // Calcula o hash SHA-256 dos bytes do PDF cobertos pelo ByteRange
  const hashSha256 = crypto.createHash("sha256");
  hashSha256.update(pdfBuffer.subarray(actualByteRange[0], actualByteRange[0] + actualByteRange[1]));
  hashSha256.update(pdfBuffer.subarray(actualByteRange[2], actualByteRange[2] + actualByteRange[3]));
  const pdfDigest = hashSha256.digest();

  // Constrói os SignedAttributes
  const signedAttributesDer = buildSignedAttributes(pdfDigest, signerCertDer, signingDate);

  // O hash que deve ser assinado pelo token USB é o SHA-256 do DER dos SignedAttributes
  const toSignHashBytes = crypto.createHash("sha256").update(signedAttributesDer).digest();
  const toSignHash = toSignHashBytes.toString("base64");

  // Cria token de sessão segura
  const sessionToken = crypto.randomUUID();
  const session: PendingSignatureSession = {
    id: letterId,
    preparedPdf: new Uint8Array(pdfBuffer),
    byteRange: actualByteRange,
    contentsOffset: contentsStart + 1,
    contentsLength: SIGNATURE_RESERVED_BYTES * 2,
    toSignHash,
    signedAttributesDer,
    signerCertDer,
    signingDate,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos de validade
  };

  return {
    session,
    toSignHash,
    sessionToken,
    certInfo,
  };
}

/**
 * 2ª Etapa: Recebe a assinatura criptográfica retornada pelo Web PKI e injeta o contêiner PKCS#7 no PDF.
 */
export async function completePdfSignature(
  session: PendingSignatureSession,
  signatureValueBase64: string
): Promise<{ signedPdf: Uint8Array; letterId: number }> {
  if (session.expiresAt < Date.now()) throw new HttpError(410, "Sessão de assinatura expirada. Inicie novamente.");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signatureValueBase64) || signatureValueBase64.length > 2048) throw new HttpError(400, "Assinatura inválida.");
  const signatureBytes = Buffer.from(signatureValueBase64, "base64");
  const certificate = new crypto.X509Certificate(session.signerCertDer);
  const verificationKey = await globalThis.crypto.subtle.importKey(
    "spki", Uint8Array.from(certificate.publicKey.export({ type: "spki", format: "der" })),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
  );
  if (!await globalThis.crypto.subtle.verify("RSASSA-PKCS1-v1_5", verificationKey, Uint8Array.from(signatureBytes), Uint8Array.from(session.signedAttributesDer))) {
    throw new HttpError(400, "A assinatura não corresponde ao certificado e ao documento preparados.");
  }

  // Montagem do contêiner PKCS#7 / CMS ContentInfo
  // 1. SignerInfo
  const issuerAndSerial = extractIssuerAndSerial(session.signerCertDer);
  const digestAlgorithm = derSequence([encodeOid(OID_SHA256), derNull()]);
  const signatureAlgorithm = derSequence([encodeOid(OID_RSA_ENCRYPTION), derNull()]);

  // CORREÇÃO CRÍTICA:
  // session.signedAttributesDer é um SET OF (tag 0x31).
  // No SignerInfo, o campo signedAttrs é [0] IMPLICIT SignedAttributes (tag 0xa0).
  // Em DER, a tag implícita substitui apenas a tag 0x31 por 0xa0, mantendo intactos
  // exatamente o mesmo cabeçalho de comprimento e o conteúdo binário dos atributos!
  const signedAttrsTag0 = new Uint8Array(session.signedAttributesDer);
  signedAttrsTag0[0] = 0xa0;

  const signerInfo = derSequence([
    derInteger(1), // version 1
    issuerAndSerial,
    digestAlgorithm,
    signedAttrsTag0,
    signatureAlgorithm,
    derOctetString(signatureBytes),
  ]);

  // 2. SignedData com cadeia completa de certificação ICP-Brasil
  const caCerts = certificatePolicy().intermediates.map((cert) => new Uint8Array(cert.toSchema().toBER(false)));
  const allCertsList: Uint8Array[] = [session.signerCertDer, ...caCerts];
  const allCertsTotalLen = allCertsList.reduce((acc, c) => acc + c.length, 0);
  const allCertsBuffer = new Uint8Array(allCertsTotalLen);
  let certOffset = 0;
  for (const c of allCertsList) {
    allCertsBuffer.set(c, certOffset);
    certOffset += c.length;
  }

  const signedData = derSequence([
    derInteger(1), // version 1
    derSet([digestAlgorithm]),
    derSequence([encodeOid(OID_PKCS7_DATA)]), // encapContentInfo (detached)
    derTag(0xa0, allCertsBuffer),             // certificates [0] IMPLICIT CertificateSet
    derSet([signerInfo]),                      // signerInfos
  ]);

  // 3. ContentInfo
  const contentInfo = derSequence([
    encodeOid(OID_PKCS7_SIGNED_DATA),
    derTag(0xa0, signedData),
  ]);

  // Converte o PKCS#7 para hexadecimal
  const pkcs7Hex = Buffer.from(contentInfo).toString("hex").toUpperCase();

  if (pkcs7Hex.length > session.contentsLength) {
    throw new Error(
      `O tamanho da assinatura (${pkcs7Hex.length} hex) excedeu o espaço reservado (${session.contentsLength} hex).`
    );
  }

  // Preenche o restante do espaço com zeros
  const paddedHex = pkcs7Hex.padEnd(session.contentsLength, "0");
  const hexBuffer = Buffer.from(paddedHex, "ascii");

  // Injeta diretamente no buffer do PDF preparado
  const finalPdfBuffer = Buffer.from(session.preparedPdf);
  hexBuffer.copy(finalPdfBuffer, session.contentsOffset);

  return {
    signedPdf: new Uint8Array(finalPdfBuffer),
    letterId: session.id,
  };
}

