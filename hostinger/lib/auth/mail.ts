import { smtpSend } from "@/lib/smtp";
import { HttpError } from "@/lib/api";
export async function sendAuthMail(to: string, subject: string, body: string) {
 const host=process.env.AUTH_SMTP_HOST || "smtp.hostinger.com";
 const port=Number(process.env.AUTH_SMTP_PORT || 465);
 const user=process.env.AUTH_SMTP_USER || "";
 const pass=process.env.AUTH_SMTP_PASS || "";
 const from=process.env.AUTH_SMTP_FROM || user;
 if(!user||!pass||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)||![465,587].includes(port))throw new HttpError(503,"O envio de códigos por e-mail ainda precisa ser configurado.");
 const mime="From: Sistema de Oficios <"+from+">\r\nTo: <"+to+">\r\nSubject: =?UTF-8?B?"+Buffer.from(subject).toString("base64")+"?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"+Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n")+"\r\n";
 try{await smtpSend({provider:"smtp",host,port,secure:port===465,user,pass,from,fromName:"Sistema de Ofícios"},to,mime);}
 catch{throw new HttpError(503,"Não foi possível enviar o código agora. Tente novamente em alguns minutos.");}
}
