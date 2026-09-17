import { withAccess } from "@/lib/access";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { getDb } from "../../../../../db";
import { documentTemplates } from "../../../../../db/schema";

export const GET = withAccess(async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Identificador inválido." }, { status: 400 });
  }
  const [template] = await getDb()
    .select({
      key: documentTemplates.sourceFileKey,
      name: documentTemplates.sourceFileName,
      type: documentTemplates.sourceFileType,
    })
    .from(documentTemplates)
    .where(eq(documentTemplates.id, id))
    .limit(1);
  if (!template || !env.BUCKET) {
    return Response.json({ error: "Arquivo do modelo não encontrado." }, { status: 404 });
  }
  const object = await env.BUCKET.get(template.key);
  if (!object) {
    return Response.json({ error: "Arquivo do modelo não encontrado." }, { status: 404 });
  }
  const safeName = template.name.replace(/[\r\n"\\/]/g, "_");
  return new Response(object.body as unknown as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": template.type,
      "Content-Disposition": `inline; filename="${safeName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
