import { apiError } from "@/lib/api";
import { withAccess } from "@/lib/access";
import { asc } from "drizzle-orm";

import { getDb } from "../../../db";
import { emailRecipients } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


export const GET = withAccess(async function GET() {
  try {
    const db = getDb();
    const recipients = await db
      .select()
      .from(emailRecipients)
      .orderBy(asc(emailRecipients.name), asc(emailRecipients.email));
    return Response.json({ recipients });
  } catch (error) { return apiError(error); }
});

export const POST = withAccess(async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = String(payload.name ?? "").trim();
    const organization = String(payload.organization ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();

    if (!name) {
      return Response.json({ error: "Informe o nome do destinatário." }, { status: 400 });
    }
    if (!emailPattern.test(email)) {
      return Response.json({ error: "Informe um endereço de e-mail válido." }, { status: 400 });
    }

    const db = getDb();
    const [recipient] = await db
      .insert(emailRecipients)
      .values({ name, organization, email })
      .returning();
    return Response.json({ recipient }, { status: 201 });
  } catch (error) { return apiError(error); }
});
