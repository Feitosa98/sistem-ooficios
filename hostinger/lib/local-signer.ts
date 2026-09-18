import type { WebPkiCertificate } from "@/components/web-pki-dialog";

const CHANNEL = "oficios-local-signer-v1";

function request<T>(command: string, payload: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(command === "sign" ? "Tempo de confirmação encerrado. Verifique a janela do assinador antes de tentar novamente." : "Assinador local indisponível. Instale o componente e a extensão e recarregue esta página."));
    }, command === "sign" ? 120000 : 10000);
    function cleanup() { window.clearTimeout(timer); window.removeEventListener("message", receive); }
    function receive(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.channel !== CHANNEL || data.direction !== "response" || data.id !== id) return;
      cleanup();
      if (data.ok === true) resolve(data.result as T);
      else reject(new Error(typeof data.error === "string" ? data.error : "Falha no assinador local."));
    }
    window.addEventListener("message", receive);
    window.postMessage({ channel: CHANNEL, direction: "request", id, command, ...payload }, window.location.origin);
  });
}

// Adapter for the existing two-stage signing flow. Private keys never cross this bridge.
function result<T>(promise: Promise<T>) {
  let onSuccess = (_value: T) => {};
  let onError = (_message: string) => {};
  void promise.then(value => onSuccess(value), error => onError(error instanceof Error ? error.message : "Falha no assinador local."));
  const chain = {
    success(callback: (value: T) => void) { onSuccess = callback; return chain; },
    error(callback: (message: string) => void) { onError = callback; return chain; },
  };
  return chain;
}

export function createLocalSigner(documentLabel: string) {
  return {
    init(options: { ready: () => void; notInstalled: () => void; defaultError: (message: string, error: unknown) => void }) {
      void request<{ version: number }>("ping").then(response => {
        if (response.version !== 1) throw new Error("Atualize o assinador local para continuar.");
        options.ready();
      }).catch(error => options.defaultError(error.message, error));
    },
    listCertificates() { return result(request<WebPkiCertificate[]>("list")); },
    readCertificate(thumbprint: string) { return result(request<string>("read", { thumbprint })); },
    signHash(options: { thumbprint: string; hash: string; digestAlgorithm: string }) {
      if (options.digestAlgorithm !== "SHA-256") return result(Promise.reject<string>(new Error("Algoritmo não suportado.")));
      return result(request<string>("sign", { thumbprint: options.thumbprint, hash: options.hash, documentLabel }));
    },
  };
}
