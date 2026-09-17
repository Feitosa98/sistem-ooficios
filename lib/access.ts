import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { appUsers } from "../db/schema";
import { apiError, HttpError } from "./api";

export type AccessUser = { email: string; displayName: string; fullName: string | null; role: "admin" | "operator" };

export function emailList(value: string | undefined): string[] {
  return (value || "").split(/[,;\n]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export async function requireAccess(admin = false): Promise<AccessUser> {
  // Identity headers are trusted only behind the Sites authenticated gateway.
  // The standalone Worker must not be exposed directly to the public internet.
  const identity = await getChatGPTUser();
  if (!identity) throw new HttpError(401, "Entre na sua conta para acessar o sistema.");
  const email = identity.email.trim().toLowerCase();
  const bootstrapAdmin = emailList(process.env.OFICIOS_ADMIN_EMAILS).includes(email);
  const [registered] = bootstrapAdmin ? [] : await getDb().select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  if (!bootstrapAdmin && (!registered || !registered.active)) {
    throw new HttpError(403, "Seu acesso ainda não foi liberado pelo administrador.");
  }
  const role = bootstrapAdmin || registered?.role === "admin" ? "admin" : "operator";
  if (admin && role !== "admin") throw new HttpError(403, "Esta operação é exclusiva do administrador.");
  return { ...identity, email, role, displayName: registered?.name || identity.displayName };
}

export function withAccess<C>(
  handler: (request: Request, context: C, user: AccessUser) => Promise<Response>,
  admin = false,
) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
          throw new HttpError(403, "Origem da requisição não permitida.");
        }
      }
      const user = await requireAccess(admin);
      const response = await handler(request, context, user);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    } catch (error) {
      const response = apiError(error);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  };
}
