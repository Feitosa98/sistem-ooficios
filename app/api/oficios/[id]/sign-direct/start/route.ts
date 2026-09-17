import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../../../db";
import { letters } from "../../../../../../db/schema";
import { withAccess } from "../../../../../../lib/access";
import { HttpError, parseId, type RouteContext } from "../../../../../../lib/api";
import { validateCertificate } from "../../../../../../lib/certificate-validation";
import { generateOficioPdf } from "../../../../../../lib/oficio-pdf";
import { oficioAssets } from "../../../../../../lib/pdf-assets";
import { preparePdfForSignature } from "../../../../../../lib/pades-signature";
import { sameSigner } from "../../../../../../lib/signers";
import { ensureSignable, saveSession } from "../../../../../../lib/signature-storage";

const inputSchema = z.object({ certificate: z.string().min(100).max(30000).regex(/^[A-Za-z0-9+/]+={0,2}$/), version: z.number().int().positive(), updateSigner: z.boolean().optional(), signerRole: z.string().trim().min(1).max(200).optional() }).strict();
export const POST = withAccess(async (request, context: RouteContext, actor) => {
  const id = parseId((await context.params).id);
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Informe certificado e versão válidos do ofício.");
  const [letter] = await getDb().select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!letter) throw new HttpError(404, "Ofício não encontrado.");
  ensureSignable(letter, input.data.version);
  const certDer = Uint8Array.from(Buffer.from(input.data.certificate, "base64"));
  const certInfo = await validateCertificate(certDer);
  const signerName = certInfo.subjectCommonName.split(":")[0].trim();
  if (!sameSigner(letter.signerName, signerName) && !input.data.updateSigner) {
    return Response.json({ error: "O certificado pertence a " + signerName + ". Confirme a alteração do signatário para continuar.", signerMismatch: true, certHolder: signerName }, { status: 400 });
  }
  const signerRole = input.data.signerRole || letter.signerRole;
  const pdf = await generateOficioPdf({ ...letter, signerName, signerRole }, { ...oficioAssets, digitalSignature: { signerName, cpf: certInfo.subjectCpf, issuer: certInfo.issuer, date: new Date() } });
  const prepared = await preparePdfForSignature(pdf, id, certDer, { signerName, reason: "Assinatura de Ofício nº " + letter.number + "/" + letter.year, location: "2º Ofício de Manacapuru/AM" });
  await saveSession(prepared.sessionToken, prepared.session, letter, actor.email, signerName, signerRole);
  return Response.json({ toSignHash: prepared.toSignHash, sessionToken: prepared.sessionToken, certHolder: signerName });
});
