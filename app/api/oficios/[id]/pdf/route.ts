import { apiError } from "@/lib/api";
import { withAccess } from "@/lib/access";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { getDb } from "../../../../../db";
import { letters } from "../../../../../db/schema";
import { generateOficioPdf } from "@/lib/oficio-pdf";
import logoDataUrl from "@/lib/assets/logo-cartorio.jpg?inline";
import watermarkDataUrl from "@/lib/assets/marca-dagua-cartorio.png?inline";

function fileName(number: number, year: number, suffix: string) {
  const cleanSuffix = suffix
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `oficio-${String(number).padStart(2, "0")}-${year}${
    cleanSuffix ? `-${cleanSuffix}` : ""
  }.pdf`;
}

function dataUrlToBytes(dataUrl: string) {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const embeddedLogo = dataUrlToBytes(logoDataUrl);
const embeddedWatermark = dataUrlToBytes(watermarkDataUrl);

export const GET = withAccess(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Identificador inválido." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [letter] = await db
      .select()
      .from(letters)
      .where(eq(letters.id, id))
      .limit(1);
    if (!letter) {
      return Response.json({ error: "Ofício não encontrado." }, { status: 404 });
    }

    if (letter.signedFileKey) {
      const object = await env.BUCKET.get(letter.signedFileKey);
      if (!object) return Response.json({error: "Documento assinado indisponível. Contate o administrador."}, {status: 404});
      if (object) {
        const disposition =
          new URL(request.url).searchParams.get("disposition") === "attachment"
            ? "attachment"
            : "inline";
        const name = letter.signedFileName || fileName(letter.number, letter.year, letter.suffix);
        return new Response(object.body as unknown as ReadableStream<Uint8Array>, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${disposition}; filename="${name}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    const pdf = await generateOficioPdf(letter, {
      logo: embeddedLogo,
      watermark: embeddedWatermark,
    });
    const disposition =
      new URL(request.url).searchParams.get("disposition") === "attachment"
        ? "attachment"
        : "inline";
    const name = fileName(letter.number, letter.year, letter.suffix);

    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return apiError(error); }
});
