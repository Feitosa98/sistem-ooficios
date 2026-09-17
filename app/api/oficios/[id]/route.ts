import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { letters } from "../../../../db/schema";
import { withAccess } from "../../../../lib/access";
import { HttpError, parseId, type RouteContext } from "../../../../lib/api";
import { letterInput } from "../../../../lib/letter-validation";

export const GET = withAccess(async (_request, context: RouteContext) => {
  const id = parseId((await context.params).id);
  const [letter] = await getDb().select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!letter) throw new HttpError(404, "Ofício não encontrado.");
  return Response.json({ letter });
});

const transitions: Record<string, string[]> = {
  Rascunho: ["Rascunho", "Em revisão"],
  "Em revisão": ["Rascunho", "Em revisão"],
  Assinado: ["Assinado", "Enviado", "Arquivado"],
  Enviado: ["Enviado", "Arquivado"],
  Arquivado: ["Arquivado"],
};
export const PATCH = withAccess(async (request, context: RouteContext) => {
  const id = parseId((await context.params).id);
  const payload = await request.json() as Record<string, unknown>;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HttpError(400, "Requisição inválida.");
  const db = getDb();
  const [current] = await db.select().from(letters).where(eq(letters.id, id)).limit(1);
  if (!current) throw new HttpError(404, "Ofício não encontrado.");
  if (!Number.isInteger(payload.version) || payload.version !== current.version) throw new HttpError(409, "Este ofício foi alterado. Atualize a lista antes de salvar.");
  const statusOnly = payload.status !== undefined && Object.keys(payload).every((key) => ["status", "version", "sentByEmail", "recipientEmail"].includes(key));
  let changes: Partial<typeof letters.$inferInsert>;
  if (statusOnly) {
    const status = String(payload.status);
    if (!transitions[current.status]?.includes(status)) throw new HttpError(409, "Esta mudança de etapa não é permitida.");
    if (["Enviado", "Arquivado"].includes(status) && !current.signedFileKey) throw new HttpError(400, "Assine o documento antes de concluir esta etapa.");
    const recipientEmail = String(payload.recipientEmail || current.recipientEmail).trim().toLowerCase();
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new HttpError(400, "E-mail de destino inválido.");
    changes = { status, ...(status === "Enviado" && payload.sentByEmail === true ? { sentAt: new Date().toISOString(), recipientEmail } : {}) };
  } else {
    if (current.signedFileKey || !["Rascunho", "Em revisão"].includes(current.status)) throw new HttpError(409, "O conteúdo de ofícios assinados ou concluídos não pode ser editado.");
    const input = letterInput.safeParse({ ...current, ...payload });
    if (!input.success) throw new HttpError(400, "Revise a data, o signatário e os campos obrigatórios.");
    if (input.data.number !== current.number || input.data.year !== current.year || input.data.suffix !== current.suffix) throw new HttpError(400, "A numeração de um ofício existente não pode ser alterada.");
    changes = input.data;
  }
  const [letter] = await db.update(letters).set({ ...changes, version: sql`${letters.version} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(letters.id, id), eq(letters.version, current.version), ...(!statusOnly ? [isNull(letters.signedFileKey)] : []))).returning();
  if (!letter) throw new HttpError(409, "Outra operação alterou este ofício. Atualize a lista.");
  return Response.json({ letter });
});
