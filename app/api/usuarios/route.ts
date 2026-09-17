import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { appUsers, auditEvents } from "../../../db/schema";
import { withAccess } from "../../../lib/access";
import { HttpError } from "../../../lib/api";

export const GET = withAccess(async () => {
  return Response.json({ users: await getDb().select().from(appUsers).orderBy(asc(appUsers.name)) });
}, true);

const inputSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  active: z.boolean(),
}).strict();

export const PATCH = withAccess(async (request, _context, actor) => {
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Informe um e-mail válido e a situação do acesso.");
  const db = getDb();
  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, input.data.id)).limit(1);
  if (!current) throw new HttpError(404, "Usuário não encontrado.");
  if (current.role === "admin") throw new HttpError(400, "O administrador principal não pode ser alterado nesta tela.");
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, input.data.email)).limit(1);
  if (existing && existing.id !== current.id) throw new HttpError(409, "Este e-mail já está associado a outro usuário.");
  const [updated] = await db.batch([
    db.update(appUsers).set({ email: input.data.email, active: input.data.active }).where(eq(appUsers.id, current.id)).returning(),
    db.insert(auditEvents).values({ actorEmail: actor.email, action: "user.access.updated", resourceId: String(current.id), createdAt: sql`CURRENT_TIMESTAMP` }),
  ]);
  return Response.json({ user: updated[0] });
}, true);
