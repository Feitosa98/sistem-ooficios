import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appUsers, auditEvents } from "@/db/schema";
import { withAccess } from "@/lib/access";
import { HttpError } from "@/lib/api";

const publicFields = {
  id: appUsers.id,
  name: appUsers.name,
  email: appUsers.email,
  role: appUsers.role,
  active: appUsers.active,
};

export const GET = withAccess(async () => {
  return Response.json({
    users: await getDb().select(publicFields).from(appUsers).orderBy(asc(appUsers.name)),
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

  const { name, role, active } = input.data;
  const email = input.data.email ? input.data.email.trim().toLowerCase() : null;

  const user = await getDb().transaction(async (tx) => {
    if (email) {
      const [existing] = await tx
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.email, email));
      if (existing) {
        throw new HttpError(409, "Este e-mail já está associado a outro usuário.");
      }
    }

    const [inserted] = await tx
      .insert(appUsers)
      .values({
        name,
        email: email || null,
        role,
        active,
        authVersion: 1,
      })
      .$returningId();

    await tx.insert(auditEvents).values({
      actorEmail: actor.email,
      action: "user.access.created",
      resourceId: String(inserted.id),
    });

    const [created] = await tx
      .select(publicFields)
      .from(appUsers)
      .where(eq(appUsers.id, inserted.id));
    return created;
  });

  return Response.json({ user }, { status: 201 });
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

  const user = await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, input.data.id))
      .for("update");
    if (!current) throw new HttpError(404, "Usuário não encontrado.");

    if ((input.data.role === "operator" || input.data.active === false) && current.role === "admin") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(appUsers)
        .where(sql`${appUsers.role} = 'admin' AND ${appUsers.active} = 1 AND ${appUsers.id} != ${current.id}`);
      if (Number(count) === 0) {
        throw new HttpError(400, "Não é possível desativar ou rebaixar o único administrador ativo do sistema.");
      }
    }

    const newEmail = input.data.email !== undefined
      ? (input.data.email ? input.data.email.trim().toLowerCase() : null)
      : undefined;

    if (newEmail !== undefined && newEmail !== null && newEmail !== current.email) {
      const [existing] = await tx
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.email, newEmail));
      if (existing && existing.id !== current.id) {
        throw new HttpError(409, "Este e-mail já está associado a outro usuário.");
      }
    }

    const emailChanged = newEmail !== undefined && newEmail !== current.email;
    const updates: Record<string, unknown> = {};

    if (input.data.name !== undefined) updates.name = input.data.name;
    if (newEmail !== undefined) updates.email = newEmail;
    if (input.data.role !== undefined) updates.role = input.data.role;
    if (input.data.active !== undefined) updates.active = input.data.active;

    if (
      emailChanged ||
      (input.data.active !== undefined && input.data.active !== current.active) ||
      (input.data.role !== undefined && input.data.role !== current.role)
    ) {
      updates.authVersion = sql`${appUsers.authVersion} + 1`;
      if (emailChanged) {
        updates.passwordHash = null;
        updates.emailVerifiedAt = null;
      }
      await tx.execute(sql`DELETE FROM auth_sessions WHERE user_id = ${current.id}`);
      await tx.execute(sql`DELETE FROM auth_tokens WHERE user_id = ${current.id}`);
    }

    if (Object.keys(updates).length > 0) {
      await tx.update(appUsers).set(updates).where(eq(appUsers.id, current.id));
    }

    await tx.insert(auditEvents).values({
      actorEmail: actor.email,
      action: "user.access.updated",
      resourceId: String(current.id),
    });

    const [updated] = await tx
      .select(publicFields)
      .from(appUsers)
      .where(eq(appUsers.id, current.id));
    return updated;
  });

  return Response.json({ user });
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

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, id))
      .for("update");
    if (!current) throw new HttpError(404, "Usuário não encontrado.");

    if (actor.email && current.email && actor.email.toLowerCase() === current.email.toLowerCase()) {
      throw new HttpError(400, "Você não pode excluir o seu próprio usuário enquanto estiver conectado.");
    }

    if (current.role === "admin") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(appUsers)
        .where(sql`${appUsers.role} = 'admin' AND ${appUsers.active} = 1 AND ${appUsers.id} != ${current.id}`);
      if (Number(count) === 0) {
        throw new HttpError(400, "Não é possível excluir o único administrador ativo do sistema.");
      }
    }

    await tx.execute(sql`DELETE FROM auth_sessions WHERE user_id = ${current.id}`);
    await tx.execute(sql`DELETE FROM auth_tokens WHERE user_id = ${current.id}`);
    await tx.delete(appUsers).where(eq(appUsers.id, current.id));

    await tx.insert(auditEvents).values({
      actorEmail: actor.email,
      action: "user.access.deleted",
      resourceId: String(current.id),
    });
  });

  return Response.json({ success: true });
}, true);

