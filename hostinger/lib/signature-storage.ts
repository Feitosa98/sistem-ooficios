import { env } from "@/lib/storage";
import { and, eq, sql, isNull, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { letters, signatureSessions, auditEvents } from "../db/schema";
import { HttpError } from "./api";
import type { PendingSignatureSession } from "./pades-signature";

export type LetterRecord = typeof letters.$inferSelect;
export function ensureSignable(letter: LetterRecord, expectedVersion: number) {
  if (letter.version !== expectedVersion) throw new HttpError(409, "O ofício foi alterado. Atualize a lista e inicie a assinatura novamente.");
  if (letter.signedFileKey || !["Rascunho", "Em revisão"].includes(letter.status)) throw new HttpError(409, "Este ofício já foi assinado ou concluído e não pode ser substituído.");
}

export async function saveSession(token: string, session: PendingSignatureSession, letter: LetterRecord, ownerEmail: string, signerName: string, signerRole: string) {
  const preparedFileKey = `assinaturas-pendentes/${token}.pdf`;
  await env.BUCKET.put(preparedFileKey, session.preparedPdf, { httpMetadata: { contentType: "application/pdf" } });
  const data = JSON.stringify({ ...session, preparedPdf: undefined, signedAttributesDer: Buffer.from(session.signedAttributesDer).toString("base64"), signerCertDer: Buffer.from(session.signerCertDer).toString("base64"), signerName, signerRole });
  await getDb().insert(signatureSessions).values({ token, letterId: letter.id, letterVersion: letter.version, ownerEmail, data, preparedFileKey, expiresAt: session.expiresAt });
}

export async function readSession(token: string, letterId: number, ownerEmail: string) {
  const [row] = await getDb().select().from(signatureSessions).where(and(eq(signatureSessions.token, token), eq(signatureSessions.letterId, letterId), eq(signatureSessions.ownerEmail, ownerEmail))).limit(1);
  if (!row) throw new HttpError(404, "Sessão de assinatura não encontrada para este usuário e ofício.");
  if (!row.completedFileKey && row.expiresAt < Date.now()) throw new HttpError(410, "Sessão de assinatura expirada. Inicie novamente.");
  const parsed = JSON.parse(row.data) as Omit<PendingSignatureSession, "signedAttributesDer" | "signerCertDer" | "preparedPdf" | "signingDate"> & { signedAttributesDer: string; signerCertDer: string; signingDate: string; signerName: string; signerRole: string };
  if (row.completedFileKey) return { row, session: null, signerName: parsed.signerName, signerRole: parsed.signerRole };
  const object = await env.BUCKET.get(row.preparedFileKey);
  if (!object) throw new HttpError(410, "O documento preparado expirou. Inicie a assinatura novamente.");
  const session: PendingSignatureSession = { ...parsed, preparedPdf: new Uint8Array(await object.arrayBuffer()), signedAttributesDer: Uint8Array.from(Buffer.from(parsed.signedAttributesDer, "base64")), signerCertDer: Uint8Array.from(Buffer.from(parsed.signerCertDer, "base64")), signingDate: new Date(parsed.signingDate) };
  return { row, session, signerName: parsed.signerName, signerRole: parsed.signerRole };
}

export async function commitSignature(letter: LetterRecord, bytes: Uint8Array, options: { ownerEmail: string; signerName: string; signerRole: string; provider: string; sessionToken?: string }) {
  const db = getDb();
  const key = `oficios-assinados/${letter.year}/${letter.id}/${crypto.randomUUID()}.pdf`;
  const fileName = `oficio-${letter.number}-${letter.year}-assinado.pdf`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
  try {
    return await db.transaction(async (tx) => {
      const [result] = await tx.update(letters).set({ signerName: options.signerName, signerRole: options.signerRole, signedFileKey:key, signedFileName:fileName, signedFileSize:bytes.length, signedAt:sql`CURRENT_TIMESTAMP`, signatureProvider:options.provider, status:"Assinado",version:sql`${letters.version}+1`,updatedAt:sql`CURRENT_TIMESTAMP` }).where(and(eq(letters.id,letter.id),eq(letters.version,letter.version),isNull(letters.signedFileKey),inArray(letters.status,["Rascunho","Em revisão"])));
      if(!result.affectedRows)throw new HttpError(409,"O ofício mudou durante a assinatura. O documento anterior foi preservado.");
      if(options.sessionToken)await tx.update(signatureSessions).set({completedFileKey:key}).where(eq(signatureSessions.token,options.sessionToken));
      await tx.insert(auditEvents).values({actorEmail:options.ownerEmail,action:"letter.signed",resourceId:String(letter.id)});
      return (await tx.select().from(letters).where(eq(letters.id,letter.id)))[0];
    });
  } catch(error) {
    if(error instanceof HttpError && error.status===409)await env.BUCKET.delete(key);
    throw error;
  }
}
