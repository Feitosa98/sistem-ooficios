import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { letters } from "../../../db/schema";
import { withAccess } from "../../../lib/access";
import { HttpError } from "../../../lib/api";
import { letterInput, isUniqueViolation } from "../../../lib/letter-validation";

export const GET = withAccess(async (request) => {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 50);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new HttpError(400, "Paginação inválida.");
  const term = (params.get("q") || "").trim().toLowerCase().slice(0, 200);
  const status = params.get("status") || "Todos";
  if (!["Todos", "Rascunho", "Em revisão", "Assinado", "Enviado", "Arquivado"].includes(status)) throw new HttpError(400, "Status inválido.");
  const match = "%" + term.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const search = term ? or(...[letters.subject, letters.recipient, letters.reference, letters.department, letters.suffix].map((field) => sql`lower(${field}) LIKE ${match} ESCAPE '\\'`), sql`printf('%03d/%d', ${letters.number}, ${letters.year}) LIKE ${match} ESCAPE '\\'`) : undefined;
  const filter = and(search, status !== "Todos" ? eq(letters.status, status) : undefined);
  const db = getDb();
  const [rows, totals, grouped, maximum, recent] = await db.batch([
    db.select().from(letters).where(filter).orderBy(desc(letters.year), desc(letters.number), desc(letters.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)` }).from(letters).where(filter),
    db.select({ status: letters.status, total: sql<number>`count(*)` }).from(letters).groupBy(letters.status),
    db.select({ number: sql<number>`coalesce(max(${letters.number}), 0)` }).from(letters).where(eq(letters.year, new Date().getFullYear())),
    db.select().from(letters).orderBy(desc(letters.createdAt), desc(letters.id)).limit(5),
  ]);
  return Response.json({ letters: rows, recentLetters: recent, total: totals[0].total, page, pageSize, nextNumber: Number(maximum[0].number) + 1, counts: Object.fromEntries(grouped.map((row) => [row.status, Number(row.total)])) });
});

export const POST = withAccess(async (request) => {
  const input = letterInput.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Revise número, data, signatário e campos obrigatórios do ofício.");
  try {
    const [letter] = await getDb().insert(letters).values(input.data).returning();
    return Response.json({ letter }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "Este número já foi utilizado. Atualize a lista para obter o próximo número.");
    throw error;
  }
});
