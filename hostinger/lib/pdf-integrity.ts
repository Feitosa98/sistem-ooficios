import { createHash } from "node:crypto";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFObject, PDFRawStream, PDFRef } from "pdf-lib";
import { HttpError } from "./api";

// Compare the actual page contents and resources, not a client-supplied identifier
// or document metadata. Conservative matching intentionally rejects rewritten PDFs.
export async function pdfContentFingerprint(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (doc.isEncrypted) throw new HttpError(400, "PDFs protegidos por senha não são aceitos.");
  for (const key of ["OpenAction", "AA", "Names", "OCProperties"]) {
    if (doc.catalog.has(PDFName.of(key))) throw new HttpError(400, "O PDF contém recursos ativos ou camadas não permitidos.");
  }
  let visited = 0;
  const canonical = (input: PDFObject | undefined, stack = new Set<PDFObject>()): unknown => {
    if (++visited > 100_000 || stack.size > 60) throw new HttpError(400, "Estrutura do PDF excede o limite permitido.");
    const value = input instanceof PDFRef ? doc.context.lookup(input) : input;
    if (!value) return null;
    if (stack.has(value)) throw new HttpError(400, "Estrutura circular no conteúdo do PDF.");
    const next = new Set(stack).add(value);
    if (value instanceof PDFRawStream) {
      return { dictionary: canonical(value.dict, next), bytes: createHash("sha256").update(value.getContents()).digest("hex") };
    }
    if (value instanceof PDFArray) return value.asArray().map((item) => canonical(item, next));
    if (value instanceof PDFDict) {
      return value.entries().filter(([key]) => !["/Length"].includes(key.toString()))
        .sort(([a], [b]) => a.toString().localeCompare(b.toString()))
        .map(([key, item]) => [key.toString(), canonical(item, next)]);
    }
    return value.toString();
  };
  const pages = doc.getPages().map((page) => {
    for (const name of ["AA", "PresSteps", "PieceInfo"]) {
      if (page.node.has(PDFName.of(name))) throw new HttpError(400, "O PDF contém alterações não permitidas.");
    }
    for (const item of page.node.Annots()?.asArray() || []) {
      const annotation = doc.context.lookup(item, PDFDict);
      const rect = annotation.lookupMaybe(PDFName.of("Rect"), PDFArray)?.asArray();
      if (!rect || rect.length !== 4 || rect.some((value) => !(value instanceof PDFNumber)) || rect[0].toString() !== rect[2].toString() || rect[1].toString() !== rect[3].toString() || annotation.has(PDFName.of("A")) || annotation.has(PDFName.of("AA"))) throw new HttpError(400, "Use uma assinatura sem carimbo visual sobre as páginas do ofício.");
      const parent = annotation.lookupMaybe(PDFName.of("Parent"), PDFDict);
      const fieldType = annotation.get(PDFName.of("FT")) || parent?.get(PDFName.of("FT"));
      if (annotation.get(PDFName.of("Subtype"))?.toString() !== "/Widget" || fieldType?.toString() !== "/Sig") {
        throw new HttpError(400, "O PDF contém anotações diferentes da assinatura.");
      }
    }
    return {
      media: canonical(page.node.MediaBox()), crop: canonical(page.node.CropBox()),
      extra: ["BleedBox", "TrimBox", "ArtBox", "UserUnit", "Group"].map((key) => canonical(page.node.get(PDFName.of(key)))),
      rotation: canonical(page.node.Rotate()), resources: canonical(page.node.Resources()),
      contents: canonical(page.node.Contents()),
    };
  });
  return createHash("sha256").update(JSON.stringify(pages)).digest("hex");
}
