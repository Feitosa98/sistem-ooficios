const origins = new Set(["https://oficios.registromanacapuru.com.br", "http://localhost:3001"]);
let signing = false;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  let origin;
  try { origin = new URL(sender.url).origin; } catch { return false; }
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || !origins.has(origin) || (sender.origin && sender.origin !== origin)) return false;
  if (!message || !["ping", "list", "read", "sign"].includes(message.command)) return false;
  const request = { command: message.command, origin };
  if (["read", "sign"].includes(message.command)) {
    if (typeof message.thumbprint !== "string" || !/^[A-Fa-f0-9]{40}$/.test(message.thumbprint)) return false;
    request.thumbprint = message.thumbprint;
  }
  if (message.command === "sign") {
    if (typeof message.hash !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(message.hash) || typeof message.documentLabel !== "string" || message.documentLabel.length > 200 || /[\x00-\x1f\x7f]/.test(message.documentLabel)) return false;
    if (signing) { respond({ ok: false, error: "Já existe uma assinatura aguardando confirmação no Windows." }); return false; }
    signing = true;
    request.hash = message.hash;
    request.documentLabel = message.documentLabel;
  }
  // A native port keeps the service worker alive while the user confirms or enters a PIN.
  let port;
  let completed = false;
  const finish = response => {
    if (completed) return;
    completed = true;
    if (message.command === "sign") signing = false;
    respond(response);
    port?.disconnect();
  };
  const unavailable = () => finish({ ok: false, error: "Componente local indisponível. Execute o instalador com o ID desta extensão e recarregue o sistema." });
  try {
    port = chrome.runtime.connectNative("br.com.registromanacapuru.oficios");
    port.onMessage.addListener(response => finish(response));
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; unavailable(); });
    port.postMessage(request);
  } catch { unavailable(); }
  return true;
});
