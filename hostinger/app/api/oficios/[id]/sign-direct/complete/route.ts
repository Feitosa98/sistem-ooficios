import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../../../db";
import { letters } from "../../../../../../db/schema";
import { withAccess } from "../../../../../../lib/access";
import { HttpError, parseId, type RouteContext } from "../../../../../../lib/api";
import { completePdfSignature } from "../../../../../../lib/pades-signature";
import { validateSignedPdf } from "../../../../../../lib/pdf-signature-validation";
import { commitSignature, ensureSignable, readSession } from "../../../../../../lib/signature-storage";
const inputSchema = z.object({ sessionToken: z.string().uuid(), signature: z.string().min(1).max(2048) }).strict();

export const POST = withAccess(async (request, context: RouteContext, actor) => {
  const id = parseId((await context.params).id);
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Token de sessão ou assinatura inválidos.");
  const saved = await readSession(input.data.sessionToken, id, actor.email);
  const [letter] = await getDb().select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!letter) throw new HttpError(404, "Ofício não encontrado.");
  if (saved.row.completedFileKey && letter.signedFileKey === saved.row.completedFileKey) return Response.json({ success: true, letter });
  ensureSignable(letter, saved.row.letterVersion);
  if (!saved.session) throw new HttpError(409, "A sessão já foi concluída.");
  const { signedPdf } = await completePdfSignature(saved.session, input.data.signature);
  await validateSignedPdf(signedPdf);
  const updated = await commitSignature(letter, signedPdf, { ownerEmail: actor.email, signerName: saved.signerName, signerRole: saved.signerRole, provider: "Web PKI — assinatura verificada", sessionToken: saved.row.token });
  return Response.json({ success: true, letter: updated, message: "Assinatura verificada e documento preservado." });
});
