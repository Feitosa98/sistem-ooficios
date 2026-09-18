import { buildEmailAlternative, renderEmailHtml } from "../email-template";
import { smtpSend } from "@/lib/smtp";
import { HttpError } from "@/lib/api";
export async function sendAuthMail(to: string, subject: string, body: string) {
 const host=process.env.AUTH_SMTP_HOST || "smtp.hostinger.com";
 const port=Number(process.env.AUTH_SMTP_PORT || 465);
 const user=process.env.AUTH_SMTP_USER || "";
 const pass=process.env.AUTH_SMTP_PASS || "";
 const from=process.env.AUTH_SMTP_FROM || user;
 if(!user||!pass||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)||![465,587].includes(port))throw new HttpError(503,"O envio de códigos por e-mail ainda precisa ser configurado.");
 const fromName = "Cartório 2º Ofício de Manacapuru";
 const html = renderEmailHtml({ fromName, subject, body });
 const boundary = `auth_${crypto.randomUUID()}`;
 const encodedFromName = "=?UTF-8?B?" + Buffer.from(fromName).toString("base64") + "?=";
 const encodedSubject = "=?UTF-8?B?" + Buffer.from(subject).toString("base64") + "?=";
 const messageId = `<auth-${crypto.randomUUID()}@oficios.registromanacapuru.com.br>`;
 const date = new Date().toUTCString();
 const mime = `From: ${encodedFromName} <${from}>\r\nTo: <${to}>\r\nSubject: ${encodedSubject}\r\nDate: ${date}\r\nMessage-ID: ${messageId}\r\nMIME-Version: 1.0\r\n` + buildEmailAlternative(body, html, boundary);
 try{await smtpSend({provider:"smtp",host,port,secure:port===465,user,pass,from,fromName},to,mime);}
 catch{throw new HttpError(503,"Não foi possível enviar o código agora. Tente novamente em alguns minutos.");}
}
