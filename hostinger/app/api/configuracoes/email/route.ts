import { apiError } from "@/lib/api";
import { withAccess } from "@/lib/access";
import { getEmailConfig, saveEmailConfig, sendEmail, type EmailConfig } from "../../../../lib/email";

export const GET = withAccess(async function GET() {
  try {
    const config = await getEmailConfig();
    return Response.json({
      config: {
        provider: config.provider,
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        passConfigured: Boolean(config.pass),
        from: config.from,
        fromName: config.fromName,
        hasApiKey: Boolean(config.apiKey),
      },
    });
  } catch (error) { return apiError(error); }
}, true);

export const POST = withAccess(async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "test") {
      const targetEmail = String(body.targetEmail || "").trim();
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return Response.json(
          { error: "Informe um endereço de e-mail válido para o teste." },
          { status: 400 },
        );
      }

      await sendEmail({
        to: targetEmail,
        subject: "Teste de Configuração - Sistema de Ofícios (2º Ofício de Manacapuru)",
        body: `Olá,\n\nEste é um e-mail de teste enviado com sucesso diretamente pelo Sistema de Ofícios do 2º Ofício de Manacapuru/AM.\n\nData e hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" })}\n\nA sua configuração de envio de e-mail está funcionando corretamente!`,
      });

      return Response.json({ success: true, message: `E-mail de teste enviado com sucesso para ${targetEmail}.` });
    }

    const payload = body as Partial<EmailConfig>;
    const saved = await saveEmailConfig({
      provider: payload.provider,
      host: String(payload.host ?? "").trim(),
      port: Number(payload.port || 465),
      secure: Boolean(payload.secure),
      user: String(payload.user ?? "").trim(),
      pass: payload.pass !== undefined ? String(payload.pass).trim() : undefined,
      from: String(payload.from ?? "").trim(),
      fromName: String(payload.fromName ?? "").trim(),
      apiKey: payload.apiKey !== undefined ? String(payload.apiKey).trim() : undefined,
    });

    return Response.json({
      success: true,
      config: {
        provider: saved.provider,
        host: saved.host,
        port: saved.port,
        secure: saved.secure,
        user: saved.user,
        passConfigured: Boolean(saved.pass),
        from: saved.from,
        fromName: saved.fromName,
        hasApiKey: Boolean(saved.apiKey),
      },
    });
  } catch (error) { return apiError(error); }
}, true);
