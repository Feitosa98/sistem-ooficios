import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { letters, signatureSessions } from "../db/schema";
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
  const statements = [env.DB.prepare("UPDATE letters SET signer_name=?, signer_role=?, signed_file_key=?, signed_file_name=?, signed_file_size=?, signed_at=CURRENT_TIMESTAMP, signature_provider=?, status='Assinado', version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND signed_file_key IS NULL AND status IN ('Rascunho','Em revisão')").bind(options.signerName, options.signerRole, key, fileName, bytes.byteLength, options.provider, letter.id, letter.version)];
  if (options.sessionToken) statements.push(env.DB.prepare("UPDATE signature_sessions SET completed_file_key=? WHERE token=? AND EXISTS(SELECT 1 FROM letters WHERE id=? AND signed_file_key=?)").bind(key, options.sessionToken, letter.id, key));
  statements.push(env.DB.prepare("INSERT INTO audit_events(actor_email,action,resource_id) SELECT ?, 'letter.signed', ? WHERE EXISTS(SELECT 1 FROM letters WHERE id=? AND signed_file_key=?)").bind(options.ownerEmail, String(letter.id), letter.id, key));
  // D1 batches are transactional: the version, session and audit commit together.
  const result = await env.DB.batch(statements);
  if (!result[0].meta.changes) {
    await env.BUCKET.delete(key);
    throw new HttpError(409, "O ofício mudou durante a assinatura. O documento anterior foi preservado.");
  }
  const [updated] = await db.select().from(letters).where(eq(letters.id, letter.id)).limit(1);
  return updated;
}
