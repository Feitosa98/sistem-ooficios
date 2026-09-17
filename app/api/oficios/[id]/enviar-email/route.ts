import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../../db";
import { letters, emailDeliveries } from "../../../../../db/schema";
import { withAccess } from "../../../../../lib/access";
import { HttpError, parseId, type RouteContext } from "../../../../../lib/api";
import { sendEmail, getReadyEmailConfig } from "../../../../../lib/email";

const inputSchema = z.object({ recipientEmail: z.string().trim().email().max(254).transform((s) => s.toLowerCase()), subject: z.string().trim().min(1).max(300).refine((s) => !/[\r\n]/.test(s)), body: z.string().max(30000) }).strict();

export const POST = withAccess(async (request, context: RouteContext, actor) => {
  const id = parseId((await context.params).id);
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Informe destinatário, assunto e mensagem válidos.");
  const db = getDb();
  const [letter] = await db.select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!letter) throw new HttpError(404, "Ofício não encontrado.");
  if (!letter.signedFileKey || !["Assinado", "Enviado"].includes(letter.status)) throw new HttpError(409, "Selecione um ofício assinado que não esteja arquivado.");
  const object = await env.BUCKET.get(letter.signedFileKey);
  if (!object) throw new HttpError(404, "O arquivo assinado não foi encontrado.");
  const emailConfig = await getReadyEmailConfig();
  const requestHash = createHash("sha256").update(JSON.stringify({ ...input.data, key: letter.signedFileKey })).digest("hex");
  const deliveryId = crypto.randomUUID();
  const [claimed] = await db.insert(emailDeliveries).values({ id: deliveryId, letterId: id, ownerEmail: actor.email, recipient: input.data.recipientEmail, documentKey: letter.signedFileKey, requestHash, state: "sending" }).onConflictDoNothing().returning();
  if (!claimed) {
    const [existing] = await db.select().from(emailDeliveries).where(and(eq(emailDeliveries.documentKey, letter.signedFileKey), eq(emailDeliveries.recipient, input.data.recipientEmail))).limit(1);
    if (existing?.state === "sent") return Response.json({ success: true, alreadySent: true, letter, message: "Este documento já foi enviado para este destinatário. Nenhum novo e-mail foi enviado." });
    throw new HttpError(409, "Já existe uma tentativa de envio para este documento e destinatário. Confira a caixa de enviados antes de tentar um envio manual.");
  }
  try {
    const result = await sendEmail({ to: input.data.recipientEmail, subject: input.data.subject, body: input.data.body, idempotencyKey: deliveryId, attachment: { filename: "oficio-" + letter.number + "-" + letter.year + "-assinado.pdf", content: await object.arrayBuffer(), contentType: "application/pdf" } }, emailConfig);
    const [, updated] = await db.batch([
      db.update(emailDeliveries).set({ state: "sent", providerId: result.providerId || null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(emailDeliveries.id, deliveryId)),
      db.update(letters).set({ status: "Enviado", sentAt: sql`CURRENT_TIMESTAMP`, recipientEmail: input.data.recipientEmail, version: sql`${letters.version} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(letters.id, id), eq(letters.signedFileKey, letter.signedFileKey), inArray(letters.status, ["Assinado", "Enviado"]))).returning(),
    ]);
    const current = updated[0] || (await db.select().from(letters).where(eq(letters.id, id)).limit(1))[0];
    return Response.json({ success: true, letter: current, message: "E-mail aceito pelo servidor e envio registrado." });
  } catch {
    // A timeout or crash after SMTP DATA may mean the server already accepted it.
    // Never turn an ambiguous result into an automatic second delivery.
    try { await db.update(emailDeliveries).set({ state: "unknown", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(emailDeliveries.id, deliveryId)); }
    catch { console.error("Envio pendente de reconciliação", { deliveryId }); }
    throw new HttpError(502, "Não foi possível confirmar o resultado do envio. Confira a caixa de enviados; uma nova tentativa automática foi bloqueada para evitar duplicação.");
  }
});
