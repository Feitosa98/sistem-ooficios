import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { appUsers, auditEvents } from "../../../db/schema";
import { withAccess } from "../../../lib/access";
import { HttpError } from "../../../lib/api";

export const GET = withAccess(async () => {
  return Response.json({
    users: await getDb().select().from(appUsers).orderBy(asc(appUsers.name)),
  });
}, true);

const createSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(150),
  email: z.string().trim().email("E-mail inválido.").max(254).transform((s) => s.toLowerCase()).optional().nullable().or(z.literal("")),
  role: z.enum(["admin", "operator"]).default("operator"),
  active: z.boolean().default(true),
}).strict();

export const POST = withAccess(async (request, _context, actor) => {
  const body = await request.json();
  const input = createSchema.safeParse(body);
  if (!input.success) {
    const issue = input.error.issues[0]?.message || "Dados inválidos.";
    throw new HttpError(400, issue);
  }

  const db = getDb();
  const email = input.data.email ? input.data.email.trim().toLowerCase() : null;
  if (email) {
    const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
    if (existing) throw new HttpError(409, "Este e-mail já está associado a outro usuário.");
  }

  const [created] = await db
    .insert(appUsers)
    .values({
      name: input.data.name,
      email: email || null,
      role: input.data.role,
      active: input.data.active,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorEmail: actor.email,
    action: "user.access.created",
    resourceId: String(created.id),
    createdAt: sql`CURRENT_TIMESTAMP`,
  });

  return Response.json({ user: created }, { status: 201 });
}, true);

const patchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(150).optional(),
  email: z.string().trim().email("E-mail inválido.").max(254).transform((s) => s.toLowerCase()).optional().nullable().or(z.literal("")),
  role: z.enum(["admin", "operator"]).optional(),
  active: z.boolean().optional(),
}).strict();

export const PATCH = withAccess(async (request, _context, actor) => {
  const body = await request.json();
  const input = patchSchema.safeParse(body);
  if (!input.success) {
    const issue = input.error.issues[0]?.message || "Dados inválidos.";
    throw new HttpError(400, issue);
  }

  const db = getDb();
  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, input.data.id)).limit(1);
  if (!current) throw new HttpError(404, "Usuário não encontrado.");

  if ((input.data.role === "operator" || input.data.active === false) && current.role === "admin") {
    const activeAdmins = await db.select().from(appUsers).where(eq(appUsers.role, "admin"));
    const otherAdmins = activeAdmins.filter((u) => u.active && u.id !== current.id);
    if (otherAdmins.length === 0) {
      throw new HttpError(400, "Não é possível desativar ou rebaixar o único administrador ativo do sistema.");
    }
  }

  const newEmail = input.data.email !== undefined
    ? (input.data.email ? input.data.email.trim().toLowerCase() : null)
    : undefined;

  if (newEmail !== undefined && newEmail !== null && newEmail !== current.email) {
    const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, newEmail)).limit(1);
    if (existing && existing.id !== current.id) {
      throw new HttpError(409, "Este e-mail já está associado a outro usuário.");
    }
  }

  const updates: Record<string, unknown> = {};
  if (input.data.name !== undefined) updates.name = input.data.name;
  if (newEmail !== undefined) updates.email = newEmail;
  if (input.data.role !== undefined) updates.role = input.data.role;
  if (input.data.active !== undefined) updates.active = input.data.active;

  const [updated] = await db.batch([
    db.update(appUsers).set(updates).where(eq(appUsers.id, current.id)).returning(),
    db.insert(auditEvents).values({
      actorEmail: actor.email,
      action: "user.access.updated",
      resourceId: String(current.id),
      createdAt: sql`CURRENT_TIMESTAMP`,
    }),
  ]);

  return Response.json({ user: updated[0] });
}, true);

export const DELETE = withAccess(async (request, _context, actor) => {
  let id: number | null = null;
  const url = new URL(request.url);
  const queryId = url.searchParams.get("id");
  if (queryId) {
    id = Number(queryId);
  } else {
    try {
      const body = await request.json();
      if (body && typeof body.id === "number") id = body.id;
    } catch {
      // not json body
    }
  }

  if (!id || !Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Identificador de usuário inválido.");
  }

  const db = getDb();
  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!current) throw new HttpError(404, "Usuário não encontrado.");

  if (actor.email && current.email && actor.email.toLowerCase() === current.email.toLowerCase()) {
    throw new HttpError(400, "Você não pode excluir o seu próprio usuário enquanto estiver conectado.");
  }

  if (current.role === "admin") {
    const activeAdmins = await db.select().from(appUsers).where(eq(appUsers.role, "admin"));
    const otherAdmins = activeAdmins.filter((u) => u.active && u.id !== current.id);
    if (otherAdmins.length === 0) {
      throw new HttpError(400, "Não é possível excluir o único administrador ativo do sistema.");
    }
  }

  await db.batch([
    db.delete(appUsers).where(eq(appUsers.id, current.id)),
    db.insert(auditEvents).values({
      actorEmail: actor.email,
      action: "user.access.deleted",
      resourceId: String(current.id),
      createdAt: sql`CURRENT_TIMESTAMP`,
    }),
  ]);

  return Response.json({ success: true });
}, true);

