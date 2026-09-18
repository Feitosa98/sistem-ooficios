import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers.mjs';

for (const prefix of ['', 'hostinger/']) {
  test(`${prefix}email HTML escapes content and preserves confirmation URLs`, () => {
    const h = harness();
    try {
      const { renderEmailHtml, buildEmailAlternative } = h.load(`${prefix}lib/email-template.ts`);
      const body = 'Olá,\nLinha 2\n\nhttps://example.com/acesso#token=abc&next=1\n\n<script>alert(1)</script>';
      const html = renderEmailHtml({ fromName: 'Cartório & Ofícios', subject: '<Assunto>', body, attachmentName: '<arquivo>.pdf' });
      assert.ok(html.includes('Olá,<br>Linha 2'));
      assert.ok(html.includes('href="https://example.com/acesso#token=abc&amp;next=1"'));
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(!html.includes('<script>'));
      assert.ok(html.includes('&lt;arquivo&gt;.pdf'));
      const mime = buildEmailAlternative(body, html, 'test-boundary');
      const parts = mime.split('--test-boundary');
      assert.equal(parts.length, 4);
      assert.equal(Buffer.from(parts[1].split('\r\n\r\n')[1].trim(), 'base64').toString(), body);
      assert.equal(Buffer.from(parts[2].split('\r\n\r\n')[1].trim(), 'base64').toString(), html);
      assert.ok(mime.split('\r\n').filter(line => /^[A-Za-z0-9+/=]+$/.test(line)).every(line => line.length <= 76));
    } finally { h.close(); }
  });
}

test('SMTP nests both message formats and keeps the PDF attachment', async () => {
  const h = harness();
  let mime;
  h.mocks.set('./smtp', { smtpSend: async (_config, _to, message) => { mime = message; } });
  try {
    await h.load('lib/email.ts').sendEmail({ to: 'recipient@example.com', subject: 'Ofício 1', body: 'Olá', attachment: { filename: 'oficio.pdf', content: new Uint8Array([37, 80, 68, 70]) } }, { provider: 'smtp', host: 'smtp.example.com', port: 465, secure: true, user: 'user', pass: 'test', from: 'sender@example.com', fromName: 'Cartório' });
    assert.match(mime, /Content-Type: multipart\/mixed/);
    assert.match(mime, /Content-Type: multipart\/alternative/);
    assert.match(mime, /Content-Type: text\/plain/);
    assert.match(mime, /Content-Type: text\/html/);
    assert.match(mime, /Content-Disposition: attachment; filename="oficio.pdf"/);
    assert.ok(mime.includes('JVBERg=='));
  } finally { h.close(); }
});

test('Resend receives HTML and plain text without adding an attachment notice', async (t) => {
  const h = harness();
  let payload;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ id: 'preview-test' });
  });
  try {
    await h.load('lib/email.ts').sendEmail({ to: 'recipient@example.com', subject: 'Teste', body: 'Mensagem de teste' }, { provider: 'resend', apiKey: 'test', host: '', port: 465, secure: true, user: '', pass: '', from: 'sender@example.com', fromName: 'Cartório' });
    assert.equal(payload.text, 'Mensagem de teste');
    assert.ok(payload.html.includes('Mensagem de teste'));
    assert.ok(!payload.html.includes('Documento em anexo'));
    assert.deepEqual(payload.attachments, []);
  } finally { h.close(); }
});
