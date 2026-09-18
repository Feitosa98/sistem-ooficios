type EmailTemplateOptions = {
  fromName: string;
  subject: string;
  body: string;
  attachmentName?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderEmailHtml(options: EmailTemplateOptions): string {
  const paragraphs = options.body.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((paragraph) => {
    // Standalone URLs remain usable in account confirmation messages.
    const text = paragraph.trim();
    const content = /^https?:\/\/[^\s<>"']+$/i.test(text)
      ? `<a href="${escapeHtml(text)}" style="color:#286454;text-decoration:underline;word-break:break-all;">${escapeHtml(text)}</a>`
      : escapeHtml(paragraph).replace(/\n/g, "<br>");
    return `<p style="margin:0 0 20px;">${content}</p>`;
  }).join("");
  const attachment = options.attachmentName
    ? `<tr><td style="padding:0 24px 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dce5df;background:#f2f6f3;border-radius:8px;"><tr><td style="padding:16px;font-size:14px;line-height:22px;color:#213b36;word-break:break-word;overflow-wrap:anywhere;"><strong>Documento em anexo</strong><br>${escapeHtml(options.attachmentName)}<br><span style="color:#586b63;">O arquivo acompanha esta mensagem.</span></td></tr></table></td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#263a35;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3ef;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed;background:#ffffff;border:1px solid #dde1df;border-radius:12px;">
<tr><td style="padding:26px 24px;background:#213b36;border-bottom:4px solid #a68845;border-radius:12px 12px 0 0;word-break:break-word;overflow-wrap:anywhere;"><p style="margin:0 0 10px;font-size:11px;line-height:16px;letter-spacing:2px;color:#e2cf9f;text-transform:uppercase;">Sistema de Ofícios</p><p style="margin:0;font-size:21px;line-height:29px;font-weight:bold;color:#ffffff;">${escapeHtml(options.fromName)}</p></td></tr>
<tr><td style="padding:28px 24px 8px;word-break:break-word;overflow-wrap:anywhere;"><h1 style="margin:0 0 24px;font-size:23px;line-height:32px;color:#213b36;">${escapeHtml(options.subject)}</h1><div style="font-size:16px;line-height:26px;">${paragraphs}</div></td></tr>
${attachment}
<tr><td style="padding:20px 24px;border-top:1px solid #e7eae7;font-size:12px;line-height:19px;color:#66736f;word-break:break-word;overflow-wrap:anywhere;">Mensagem enviada por ${escapeHtml(options.fromName)}<br>Sistema de Ofícios</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

/** Both representations are sent so clients can choose HTML or plain text. */
export function buildEmailAlternative(body: string, html: string, boundary: string): string {
  const part = (type: string, content: string) =>
    `--${boundary}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(content, "utf-8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || ""}\r\n`;
  return `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n${part("text/plain", body)}${part("text/html", html)}--${boundary}--\r\n`;
}
