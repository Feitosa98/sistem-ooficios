import { buildEmailAlternative, renderEmailHtml } from "./email-template";
import { smtpSend } from "./smtp";
import { HttpError } from "./api";
import { eq, sql } from "drizzle-orm";

import { getDb } from "../db";
import { systemSettings } from "../db/schema";

export type EmailConfig = {
  provider: "smtp" | "resend";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  apiKey?: string;
};

export type SendEmailOptions = {
  to: string;
  subject: string;
  body: string;
  idempotencyKey?: string;
  attachment?: {
    filename: string;
    content: Uint8Array | ArrayBuffer;
    contentType?: string;
  };
};

export async function getEmailConfig(): Promise<EmailConfig> {
  const [row] = await getDb().select().from(systemSettings).where(eq(systemSettings.key, "email_config")).limit(1);
  const dbConfig: Partial<EmailConfig> = row ? JSON.parse(row.value) : {};

  const host = dbConfig.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(dbConfig.port || process.env.SMTP_PORT || 465);
  const secure =
    dbConfig.secure !== undefined
      ? Boolean(dbConfig.secure)
      : port === 465;

  return {
    provider: (dbConfig.provider ||
      (dbConfig.apiKey || process.env.RESEND_API_KEY ? "resend" : "smtp")) as
      | "smtp"
      | "resend",
    host,
    port,
    secure,
    user: dbConfig.user || process.env.SMTP_USER || "",
    pass: dbConfig.pass || process.env.SMTP_PASS || "",
    from:
      dbConfig.from ||
      process.env.SMTP_FROM ||
      dbConfig.user ||
      process.env.SMTP_USER ||
      "ri.tdpj2oficio@gmail.com",
    fromName:
      dbConfig.fromName ||
      process.env.SMTP_FROM_NAME ||
      "2º Ofício de Manacapuru/AM",
    apiKey: dbConfig.apiKey || process.env.RESEND_API_KEY || "",
  };
}

export async function saveEmailConfig(
  config: Partial<EmailConfig>,
): Promise<EmailConfig> {
  const current = await getEmailConfig();
  const updated: EmailConfig = {
    provider: config.provider || current.provider,
    host: config.host || current.host,
    port: Number(config.port || current.port),
    secure: config.secure !== undefined ? Boolean(config.secure) : current.secure,
    user: config.user !== undefined ? config.user : current.user,
    pass: config.pass !== undefined && config.pass !== "" ? config.pass : current.pass,
    from: config.from || current.from,
    fromName: config.fromName || current.fromName,
    apiKey: config.apiKey ? config.apiKey : current.apiKey,
  };

  const db = getDb();

  validateEmailConfig(updated);
  const value = JSON.stringify(updated);
  await db
    .insert(systemSettings)
    .values({ key: "email_config", value })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    });

  return updated;
}

function encodeMimeWord(text: string): string {
  if (/^[\x20-\x7E]+$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf-8").toString("base64")}?=`;
}

function buildMimeMessage(
  fromName: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
  attachment?: { filename: string; content: Uint8Array | ArrayBuffer; contentType?: string },
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${fromEmail.split("@")[1] || "cartorio.local"}>`;

  let mime = "";
  mime += `From: ${encodeMimeWord(fromName)} <${fromEmail}>\r\n`;
  mime += `To: <${toEmail}>\r\n`;
  mime += `Subject: ${encodeMimeWord(subject)}\r\n`;
  mime += `Date: ${date}\r\n`;
  mime += `Message-ID: ${messageId}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;

  const html = renderEmailHtml({ fromName, subject, body, attachmentName: attachment?.filename });
  const alternative = buildEmailAlternative(body, html, `${boundary}_alternative`);
  if (!attachment) return mime + alternative;

  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  mime += `--${boundary}\r\n${alternative}\r\n`;

  // Attachment part
  const safeFilename = attachment.filename.replace(/[\r\n"]/g, "");
  const mimeType = attachment.contentType || "application/pdf";
  const bytes = attachment.content instanceof Uint8Array
    ? attachment.content
    : new Uint8Array(attachment.content);
  const base64Content = Buffer.from(bytes).toString("base64");
  const base64Lines = base64Content.match(/.{1,76}/g)?.join("\r\n") || base64Content;

  mime += `--${boundary}\r\n`;
  mime += `Content-Type: ${mimeType}; name="${encodeMimeWord(safeFilename)}"\r\n`;
  mime += `Content-Transfer-Encoding: base64\r\n`;
  mime += `Content-Disposition: attachment; filename="${encodeMimeWord(safeFilename)}"\r\n\r\n`;
  mime += base64Lines + "\r\n\r\n";

  mime += `--${boundary}--\r\n`;
  return mime;
}

export async function getReadyEmailConfig(): Promise<EmailConfig> {
  const config = await getEmailConfig();
  validateEmailConfig(config);
  if (config.provider === "resend" && !config.apiKey) throw new HttpError(400, "Configure a chave do provedor de e-mail.");
  if (config.provider === "smtp" && (!config.user || !config.pass)) throw new HttpError(400, "O administrador precisa configurar o usuário e a senha de aplicativo do e-mail.");
  return config;
}

export async function sendEmail(options: SendEmailOptions, providedConfig?: EmailConfig): Promise<{ success: boolean; message: string; providerId?: string }> {
  const config = providedConfig || await getReadyEmailConfig();
  validateEmailConfig(config);
  if (!emailAddress.test(options.to) || /[\r\n]/.test(options.subject)) throw new HttpError(400, "Destinatário ou assunto inválidos.");

  if (config.provider === "resend" && !config.apiKey) throw new HttpError(400, "Configure a chave do provedor de e-mail.");
  if (config.provider === "resend" && config.apiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      signal: AbortSignal.timeout(30000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.from}>`,
        to: [options.to],
        subject: options.subject,
        text: options.body,
        html: renderEmailHtml({ fromName: config.fromName, subject: options.subject, body: options.body, attachmentName: options.attachment?.filename }),
        attachments: options.attachment
          ? [
              {
                filename: options.attachment.filename,
                content: Buffer.from(
                  options.attachment.content instanceof Uint8Array
                    ? options.attachment.content
                    : new Uint8Array(options.attachment.content),
                ).toString("base64"),
              },
            ]
          : [],
      }),
    });

    if (!response.ok) {
      throw new Error("O provedor de e-mail recusou a solicitação (HTTP " + response.status + ").");
    }

    const result = await response.json() as { id?: string };
    return { success: true, message: "E-mail enviado com sucesso via Resend.", providerId: result.id };
  }

  if (!config.user || !config.pass) {
    throw new Error(
      "Configuração de e-mail incompleta. Configure o usuário e a senha de aplicativo SMTP na aba 'Configurações' para enviar e-mails diretamente.",
    );
  }

  const mime = buildMimeMessage(
    config.fromName,
    config.from,
    options.to,
    options.subject,
    options.body,
    options.attachment,
  );

  await smtpSend(config, options.to, mime);

  return { success: true, message: "E-mail enviado com sucesso via SMTP." };
}

const emailAddress = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function validateEmailConfig(config: EmailConfig) {
  if (!["smtp", "resend"].includes(config.provider) || !emailAddress.test(config.from) || /[\r\n]/.test(config.fromName)) throw new HttpError(400, "Configuração de remetente inválida.");
  if (config.provider === "smtp" && (!/^[a-zA-Z0-9.-]+$/.test(config.host) || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || (!config.secure && config.port !== 587))) throw new HttpError(400, "Use um servidor SMTP válido com TLS ou STARTTLS na porta 587.");
}
