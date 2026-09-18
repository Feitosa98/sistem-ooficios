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

export function renderEmailHtml(options: EmailTemplateOptions & { code?: string }): string {
  const isCodeEmail = /código/i.test(options.subject) || /código/i.test(options.body);
  const codeMatch = options.code || (/(?:código[^:\d]*[:\s]+)([0-9]{6})\b/i.exec(options.body)?.[1]) || (/(\b[0-9]{6}\b)/.exec(options.body)?.[1]);

  let contentHtml = "";

  if (codeMatch && isCodeEmail) {
    contentHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#09090b;">
        Você solicitou a confirmação de acesso ao <strong>Sistema de Gestão de Ofícios</strong>. Utilize o código de verificação abaixo para concluir sua autenticação:
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:26px auto 28px;background:#fdfbf7;border:2px dashed #a68845;border-radius:12px;box-shadow:0 4px 14px rgba(166,136,69,0.12);">
        <tr>
          <td style="padding:22px 36px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a7135;margin-bottom:8px;">Código de Verificação</div>
            <div style="font-family:'Courier New',Courier,Consolas,monospace;font-size:42px;font-weight:800;letter-spacing:14px;color:#09090b;padding-left:14px;line-height:46px;">
              ${escapeHtml(codeMatch)}
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;border-left:4px solid #09090b;border-radius:0 8px 8px 0;margin:0 0 20px;text-align:left;">
        <tr>
          <td style="padding:14px 18px;font-size:13px;line-height:21px;color:#3f3f46;">
            ⏱ <strong>Validade:</strong> Este código expira em <strong>10 minutos</strong>.<br>
            🔒 <strong>Segurança:</strong> Nunca compartilhe este código com ninguém. Se você não tentou entrar, altere sua senha no sistema.
          </td>
        </tr>
      </table>
    `;
  } else {
    contentHtml = options.body.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((paragraph) => {
      const text = paragraph.trim();
      const content = /^https?:\/\/[^\s<>"']+$/i.test(text)
        ? `<div style="text-align:center;margin:24px 0;"><a href="${escapeHtml(text)}" target="_blank" style="background:#09090b;border:1px solid #a68845;border-radius:8px;color:#ffffff;display:inline-block;font-size:15px;font-weight:700;line-height:18px;padding:15px 32px;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);">Confirmar no Sistema &rarr;</a><br><span style="display:block;margin-top:12px;font-size:11px;color:#66736f;word-break:break-all;">Link direto: <a href="${escapeHtml(text)}" style="color:#09090b;text-decoration:underline;">${escapeHtml(text)}</a></span></div>`
        : escapeHtml(paragraph).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 20px;">${content}</p>`;
    }).join("");
  }

  const attachment = options.attachmentName
    ? `<tr><td style="padding:0 24px 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4e4e7;background:#f4f4f5;border-radius:8px;"><tr><td style="padding:16px;font-size:14px;line-height:22px;color:#09090b;word-break:break-word;overflow-wrap:anywhere;"><strong>📎 Documento em anexo</strong><br><span style="font-size:15px;font-weight:600;color:#09090b;">${escapeHtml(options.attachmentName)}</span><br><span style="color:#71717a;font-size:12px;">O arquivo em PDF assinado acompanha esta mensagem.</span></td></tr></table></td></tr>`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3ef;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed;background:#ffffff;border:1px solid #dde1df;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
<tr><td style="padding:26px 24px;background:#09090b;border-bottom:4px solid #a68845;border-radius:12px 12px 0 0;word-break:break-word;overflow-wrap:anywhere;text-align:center;"><p style="margin:0 0 6px;font-size:11px;line-height:16px;letter-spacing:2px;color:#e2cf9f;text-transform:uppercase;font-weight:700;">Cartório 2º Ofício de Manacapuru/AM</p><p style="margin:0;font-size:22px;line-height:29px;font-weight:bold;color:#ffffff;font-family:Georgia,serif;">${escapeHtml(options.fromName)}</p></td></tr>
<tr><td style="padding:28px 24px 8px;word-break:break-word;overflow-wrap:anywhere;"><h1 style="margin:0 0 22px;font-size:22px;line-height:30px;color:#09090b;font-family:Georgia,serif;">${escapeHtml(options.subject)}</h1><div style="font-size:15px;line-height:26px;">${contentHtml}</div></td></tr>
${attachment}
<tr><td style="padding:20px 24px;border-top:1px solid #e7eae7;font-size:12px;line-height:19px;color:#66736f;word-break:break-word;overflow-wrap:anywhere;text-align:center;background:#fafaf8;border-radius:0 0 12px 12px;">
  <strong>Cartório do 2º Ofício de Manacapuru — Registro de Imóveis e RTDPJ/RCPN</strong><br>
  <span style="font-size:11px;color:#88948e;">Av. Ribeiro Júnior, nº 373, Centro, Manacapuru/AM — CEP 69.400-366</span><br>
  <span style="font-size:11px;color:#88948e;">Mensagem enviada por ${escapeHtml(options.fromName)} · Sistema de Gestão de Ofícios</span>
</td></tr>
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
