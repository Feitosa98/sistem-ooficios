import { apiError } from "@/lib/api";
import { HttpError } from "@/lib/api";
import { validateSignedPdf } from "@/lib/pdf-signature-validation";
import { pdfContentFingerprint } from "@/lib/pdf-integrity";
import { generateOficioPdf } from "@/lib/oficio-pdf";
import { oficioAssets } from "@/lib/pdf-assets";
import { sameSigner } from "@/lib/signers";
import { ensureSignable, commitSignature } from "@/lib/signature-storage";
import { withAccess } from "@/lib/access";
import { env } from "@/lib/storage";
import { eq } from "drizzle-orm";

import { getDb } from "../../../../../db";
import { letters } from "../../../../../db/schema";

const MAX_PDF_SIZE = 20 * 1024 * 1024;

function parseId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeFileName(name: string) {
  return name.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "oficio-assinado.pdf";
}

function downloadHeaders(fileName: string, inline = true) {
  const asciiName = safeFileName(fileName).replace(/[^\x20-\x7E]/g, "_");
  const dispositionType = inline ? "inline" : "attachment";
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${dispositionType}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
      safeFileName(fileName),
    )}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export const POST = withAccess(async (request: Request, { params }: { params: Promise<{ id: string }> }, actor) => {
  const id = parseId((await params).id);
  if (!id) throw new HttpError(400, "Identificador inválido.");
  const formData = await request.formData();
  const file = formData.get("file");
  const version = Number(formData.get("version"));
  if (!(file instanceof File) || file.size < 5 || file.size > MAX_PDF_SIZE) throw new HttpError(400, "Selecione um PDF de até 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) throw new HttpError(400, "O arquivo enviado não é um PDF válido.");
  const [letter] = await getDb().select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!letter) throw new HttpError(404, "Ofício não encontrado.");
  ensureSignable(letter, version);
  const identity = await validateSignedPdf(bytes);
  const signerName = identity.subjectCommonName.split(":")[0].trim();
  if (!sameSigner(letter.signerName, signerName)) throw new HttpError(400, "O titular da assinatura não corresponde ao signatário do ofício.");
  const original = await generateOficioPdf(letter, oficioAssets);
  if (await pdfContentFingerprint(bytes) !== await pdfContentFingerprint(original)) throw new HttpError(400, "O PDF não corresponde ao conteúdo atual do ofício. Baixe o original novamente e assine sem editar seu conteúdo.");
  const provider = formData.get("provider") === "Adobe Acrobat" ? "Adobe Acrobat" : "ONR";
  const updated = await commitSignature(letter, bytes, { ownerEmail: actor.email, signerName, signerRole: letter.signerRole, provider: provider + " — assinatura verificada" });
  return Response.json({ letter: updated });
});

export const GET = withAccess(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return Response.json({ error: "Identificador inválido." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [letter] = await db
      .select({
        signedFileKey: letters.signedFileKey,
        signedFileName: letters.signedFileName,
      })
      .from(letters)
      .where(eq(letters.id, id))
      .limit(1);

    if (!letter?.signedFileKey || !env.BUCKET) {
      return Response.json({ error: "PDF assinado não encontrado." }, { status: 404 });
    }
    const object = await env.BUCKET.get(letter.signedFileKey);
    if (!object) {
      return Response.json({ error: "PDF assinado não encontrado." }, { status: 404 });
    }

    const url = new URL(request.url);
    const inline = url.searchParams.get("disposition") !== "attachment";

    return new Response(object.body as unknown as ReadableStream<Uint8Array>, {
      headers: downloadHeaders(
        letter.signedFileName || "oficio-assinado-onr.pdf",
        inline,
      ),
    });
  } catch (error) { return apiError(error); }
});
