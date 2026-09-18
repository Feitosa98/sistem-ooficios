(() => {
  const origins = new Set(["https://oficios.registromanacapuru.com.br", "http://localhost:3001"]);
  if (window.top !== window || !origins.has(location.origin)) return;
  const channel = "oficios-local-signer-v1";
  const pending = new Set();
  window.addEventListener("message", async event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || !data || data.channel !== channel || data.direction !== "request") return;
    if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id) || pending.has(data.id)) return;
    if (!["ping", "list", "read", "sign"].includes(data.command)) return;
    if (pending.size >= 4) return;
    pending.add(data.id);
    let response;
    try {
      response = await chrome.runtime.sendMessage({ command: data.command, thumbprint: data.thumbprint, hash: data.hash, documentLabel: data.documentLabel });
    } catch {
      response = { ok: false, error: "Extensão desconectada. Recarregue a página após instalar ou atualizar." };
    } finally { pending.delete(data.id); }
    window.postMessage({ channel, direction: "response", id: data.id, ...response }, location.origin);
  });
})();
