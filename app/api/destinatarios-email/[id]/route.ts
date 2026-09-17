import { apiError } from "@/lib/api";
import { withAccess } from "@/lib/access";
import { eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { emailRecipients } from "../../../../db/schema";

export const DELETE = withAccess(async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Identificador inválido." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [removed] = await db
      .delete(emailRecipients)
      .where(eq(emailRecipients.id, id))
      .returning({ id: emailRecipients.id });
    if (!removed) {
      return Response.json({ error: "Destinatário não encontrado." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
});
