import { apiError } from "@/lib/api";
import { withAccess } from "@/lib/access";
import { env } from "@/lib/storage";
import { desc, eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { documentTemplates } from "../../../db/schema";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(name: string) {
  return name.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "modelo.pdf";
}

export const GET = withAccess(async function GET() {
  try {
    const rows = await getDb()
      .select()
      .from(documentTemplates)
      .orderBy(desc(documentTemplates.createdAt), desc(documentTemplates.id))
      .limit(100);
    return Response.json({ templates: rows });
  } catch (error) { return apiError(error); }
});

export const POST = withAccess(async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const title = clean(formData.get("title"));
    if (!title) {
      return Response.json({ error: "Informe o nome do modelo." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "Selecione o arquivo do modelo." }, { status: 400 });
    }
    if (file.size < 5 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "O arquivo deve ter no máximo 20 MB." }, { status: 400 });
    }
    const extension = file.name.toLocaleLowerCase().split(".").pop();
    const inferredType = extension === "pdf"
      ? "application/pdf"
      : extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : file.type;
    if (!ALLOWED_TYPES.has(inferredType)) {
      return Response.json({ error: "Envie um arquivo PDF ou DOCX." }, { status: 400 });
    }
    if (!env.BUCKET) throw new Error("O armazenamento de modelos não está disponível.");

    const bytes = await file.arrayBuffer();
    if (inferredType === "application/pdf") {
      const signature = new TextDecoder().decode(bytes.slice(0, 5));
      if (signature !== "%PDF-") {
        return Response.json({ error: "O arquivo não é um PDF válido." }, { status: 400 });
      }
    }

    const fileName = safeFileName(file.name);
    const key = `modelos/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: inferredType },
      customMetadata: { titulo: title },
    });

    try {
      const [inserted] = await getDb()
        .insert(documentTemplates)
        .values({
          title,
          description: clean(formData.get("description")),
          department: clean(formData.get("department")) || "RI/RTDPJ",
          subject: clean(formData.get("subject")),
          recipient: clean(formData.get("recipient")),
          recipientRole: "",
          salutation: clean(formData.get("salutation")) || "Prezado(a),",
          body: clean(formData.get("body")),
          closing:
            clean(formData.get("closing")) ||
            "Sem outro assunto para o momento, renovamos votos de elevada estima e consideração.",
          sourceFileKey: key,
          sourceFileName: fileName,
          sourceFileType: inferredType,
          sourceFileSize: file.size,
        })
        .$returningId();
      const [template] = await getDb().select().from(documentTemplates).where(eq(documentTemplates.id, inserted.id)).limit(1);
      return Response.json({ template }, { status: 201 });
    } catch (error) { return apiError(error); }
  } catch (error) { return apiError(error); }
});
