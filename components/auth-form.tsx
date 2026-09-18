"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  KeyRound,
  Lock,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Download,
  ExternalLink,
  Usb,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLocalSigner } from "@/lib/local-signer";
import type { WebPkiCertificate } from "@/components/web-pki-dialog";

type PkiSigner = {
  readCertificate: (thumbprint: string) => { success: (cb: (data: string) => void) => { error: (cb: (err: string) => void) => void } };
  signHash: (options: { thumbprint: string; hash: string; digestAlgorithm: string }) => { success: (cb: (sig: string) => void) => { error: (cb: (err: string) => void) => void } };
};

export function AuthForm({ setup = false }: { setup?: boolean }) {
  const [authMethod, setAuthMethod] = useState<"cert" | "credentials">(setup ? "credentials" : "cert");
  const [mode, setMode] = useState<"login" | "request" | "mfa" | "password" | "done">(setup ? "password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [certState, setCertState] = useState<"checking" | "ready" | "not_installed" | "error">("checking");
  const [certificates, setCertificates] = useState<WebPkiCertificate[]>([]);
  const [selectedThumbprint, setSelectedThumbprint] = useState<string>("");
  const [certError, setCertError] = useState("");
  const [signingPin, setSigningPin] = useState(false);
  const pkiRef = useRef<PkiSigner | null>(null);

  useEffect(() => {
    if (setup) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      setSetupToken(token);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setup]);

  useEffect(() => {
    if (authMethod === "cert" && !setup) {
      void initCerts();
    }
  }, [authMethod, setup]);

  const ensureScriptLoaded = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof (window as unknown as { LacunaWebPKI?: unknown }).LacunaWebPKI !== "undefined") {
        resolve();
        return;
      }
      const stale = document.querySelectorAll('script[src*="lacuna-web-pki"]');
      stale.forEach((el) => el.remove());
      const script = document.createElement("script");
      script.src = "https://cdn.lacunasoftware.com/libs/web-pki/lacuna-web-pki-2.14.3.min.js";
      script.async = true;
      script.onload = () => {
        if (typeof (window as unknown as { LacunaWebPKI?: unknown }).LacunaWebPKI !== "undefined") resolve();
        else reject(new Error("Extensão Web PKI não encontrada."));
      };
      script.onerror = () => reject(new Error("Falha ao carregar componente Web PKI."));
      document.head.appendChild(script);
    });
  };

  async function initCerts() {
    setCertState("checking");
    setCertError("");
    pkiRef.current = null;
    setCertificates([]);
    setSelectedThumbprint("");

    try {
      const local = createLocalSigner("Autenticação no Sistema de Ofícios — 2º Ofício de Manacapuru");
      let responded = false;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!responded) reject(new Error("timeout"));
        }, 1500);

        local.init({
          ready: () => {
            responded = true;
            clearTimeout(timer);
            pkiRef.current = local as unknown as PkiSigner;
            local
              .listCertificates()
              .success((certs: WebPkiCertificate[]) => {
                const list = certs || [];
                setCertificates(list);
                if (list.length > 0) {
                  setSelectedThumbprint(list[0].thumbprint);
                  setCertState("ready");
                } else {
                  setCertState("not_installed");
                }
                resolve();
              })
              .error((err: string) => {
                setCertError(err);
                setCertState("error");
                resolve();
              });
          },
          notInstalled: () => {
            responded = true;
            clearTimeout(timer);
            reject(new Error("not_installed"));
          },
          defaultError: () => {
            responded = true;
            clearTimeout(timer);
            reject(new Error("error"));
          },
        });
      });
      return;
    } catch {}

    try {
      await ensureScriptLoaded();
      const LacunaWebPKI = (window as unknown as { LacunaWebPKI: new () => {
        init: (opts: { ready: () => void; notInstalled: () => void; defaultError: (msg: string) => void }) => void;
        listCertificates: () => { success: (cb: (certs: WebPkiCertificate[]) => void) => { error: (cb: (err: string) => void) => void } };
        readCertificate: (thumbprint: string) => { success: (cb: (data: string) => void) => { error: (cb: (err: string) => void) => void } };
        signHash: (opts: { thumbprint: string; hash: string; digestAlgorithm: string }) => { success: (cb: (sig: string) => void) => { error: (cb: (err: string) => void) => void } };
      } }).LacunaWebPKI;

      if (!LacunaWebPKI) {
        setCertState("not_installed");
        return;
      }

      const pki = new LacunaWebPKI();
      pkiRef.current = pki as unknown as PkiSigner;

      pki.init({
        ready: () => {
          pki
            .listCertificates()
            .success((certs: WebPkiCertificate[]) => {
              const list = certs || [];
              setCertificates(list);
              if (list.length > 0) {
                setSelectedThumbprint(list[0].thumbprint);
                setCertState("ready");
              } else {
                setCertState("not_installed");
              }
            })
            .error((err: string) => {
              setCertError(err);
              setCertState("error");
            });
        },
        notInstalled: () => {
          setCertState("not_installed");
        },
        defaultError: (msg: string) => {
          setCertError(msg);
          setCertState("not_installed");
        },
      });
    } catch {
      setCertState("not_installed");
    }
  }

  async function handleCertLogin() {
    if (!selectedThumbprint || !pkiRef.current) return;
    setBusy(true);
    setCertError("");
    setSigningPin(true);

    try {
      const challengeRes = await fetch("/api/auth/cert-challenge", { method: "POST" });
      if (!challengeRes.ok) {
        const errJson = await challengeRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Não foi possível gerar desafio de autenticação.");
      }
      const { challenge, toSignHash } = await challengeRes.json();

      const certBase64 = await new Promise<string>((resolve, reject) => {
        pkiRef.current!.readCertificate(selectedThumbprint)
          .success((data: string) => resolve(data))
          .error((err: string) => reject(new Error(err || "Falha ao ler o certificado digital.")));
      });

      const signature = await new Promise<string>((resolve, reject) => {
        pkiRef.current!.signHash({
          thumbprint: selectedThumbprint,
          hash: toSignHash,
          digestAlgorithm: "SHA-256",
        })
        .success((sig: string) => resolve(sig))
        .error((err: string) => {
          const msg = typeof err === "string" ? err : "Falha na assinatura do token.";
          reject(new Error(msg.includes("cancel") ? "Operação de assinatura cancelada pelo usuário." : msg));
        });
      });

      setSigningPin(false);

      const loginRes = await fetch("/api/auth/cert-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge,
          certificate: certBase64,
          signature,
        }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.error || "Falha ao autenticar com o certificado digital.");
      }

      window.location.replace("/");
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "Erro durante a autenticação por certificado.");
      setSigningPin(false);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "password" && password !== confirm) {
        throw new Error("As senhas precisam ser iguais.");
      }
      const action =
        mode === "request" ? "setup" : mode === "password" ? "password" : mode === "mfa" ? "verify" : "login";
      const body =
        mode === "request"
          ? { email }
          : mode === "password"
            ? { token: setupToken, password }
            : mode === "mfa"
              ? { challenge, code }
              : { email, password };

      const response = await fetch("/api/auth/" + action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");

      if (mode === "login") {
        if (result.directLogin) {
          window.location.replace("/");
        } else {
          setChallenge(result.challenge);
          setPassword("");
          setMode("mfa");
        }
      } else if (mode === "mfa") {
        window.location.replace("/");
      } else if (mode === "password") {
        setPassword("");
        setConfirm("");
        setSetupToken("");
        setMode("done");
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setMode("login");
    setPassword("");
    setCode("");
    setError("");
    setMessage("");
  }

  if (mode === "done") {
    return (
      <div className="auth-fields">
        <p role="status" className="auth-note">
          E-mail confirmado e senha salva. Entre para acessar o sistema.
        </p>
        <Button asChild className="login-submit">
          <a href="/">Ir para o login</a>
        </Button>
      </div>
    );
  }

  const selectedCert = certificates.find((c) => c.thumbprint === selectedThumbprint) || certificates[0];

  return (
    <div className="w-full">
      {!setup && mode === "login" && (
        <div className="flex rounded-lg bg-zinc-100 p-1 border border-zinc-200/80 mb-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("cert");
              setError("");
              setMessage("");
            }}
            className={`flex-1 py-2 px-3 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
              authMethod === "cert"
                ? "bg-[#09090b] text-white shadow-sm font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <KeyRound className="size-3.5 text-[#d6c28a]" />
            <span>Certificado Digital</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("credentials");
              setCertError("");
            }}
            className={`flex-1 py-2 px-3 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
              authMethod === "credentials"
                ? "bg-[#09090b] text-white shadow-sm font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Lock className="size-3.5 text-[#d6c28a]" />
            <span>E-mail e Senha</span>
          </button>
        </div>
      )}

      {authMethod === "cert" && !setup && mode === "login" ? (
        <div className="auth-fields">
          {certState === "checking" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center space-y-3">
              <Loader2 className="size-6 animate-spin mx-auto text-zinc-700" />
              <p className="text-xs text-zinc-600 font-medium">
                Detectando certificados instalados e Token USB...
              </p>
            </div>
          )}

          {certState === "ready" && selectedCert && (
            <div className="space-y-3">
              {certificates.length > 1 && (
                <div>
                  <label htmlFor="cert-select" className="text-xs font-semibold text-zinc-700 block mb-1.5">
                    Selecione o Certificado Digital
                  </label>
                  <select
                    id="cert-select"
                    value={selectedThumbprint}
                    onChange={(e) => setSelectedThumbprint(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#a68845]"
                  >
                    {certificates.map((c) => (
                      <option key={c.thumbprint} value={c.thumbprint}>
                        {c.subjectName.split(":")[0]} ({c.issuerName || "ICP-Brasil"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-amber-50 border border-amber-200/70 grid place-items-center text-amber-800 shrink-0">
                    <ShieldCheck className="size-5 text-[#9e7d3b]" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold text-zinc-900 truncate">
                      {selectedCert.subjectName.split(":")[0]}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {selectedCert.issuerName || "ICP-Brasil"}
                    </p>
                    {selectedCert.subjectName.includes(":") && (
                      <p className="text-[11px] font-mono text-zinc-600 mt-0.5">
                        CPF: {selectedCert.subjectName.split(":")[1]?.slice(0, 11) || ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {signingPin && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2.5 animate-pulse">
                  <Loader2 className="size-4 animate-spin text-amber-600 shrink-0" />
                  <span>
                    Aguardando confirmação do Token USB. Digite o PIN na janela do Windows se solicitado.
                  </span>
                </div>
              )}

              {certError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{certError}</span>
                </div>
              )}

              <Button
                type="button"
                disabled={busy}
                onClick={handleCertLogin}
                className="login-submit !bg-[#09090b] hover:!bg-[#18181b] !text-white !h-12 !text-sm font-semibold flex items-center justify-between"
              >
                <span>{busy ? "Autenticando..." : "Entrar com Certificado Digital"}</span>
                <ArrowRight className="size-4 text-[#d6c28a]" />
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={initCerts}
                  className="text-xs text-zinc-500 hover:text-zinc-800 inline-flex items-center gap-1"
                >
                  <RefreshCw className="size-3" /> Atualizar certificados
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod("credentials")}
                  className="text-xs text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
                >
                  Entrar com e-mail e senha
                </button>
              </div>
            </div>
          )}

          {certState === "not_installed" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <Usb className="size-4 text-zinc-500 mt-0.5 shrink-0" />
                <div className="text-zinc-600 leading-relaxed text-left">
                  <p className="font-semibold text-zinc-900">Nenhum certificado digital detectado</p>
                  <p className="mt-1">
                    Conecte seu Token USB A3 na porta USB ou certifique-se de que seu certificado A1 está instalado no Windows.
                  </p>
                </div>
              </div>

              {certError && (
                <p className="text-red-700 bg-red-50 p-2 rounded border border-red-200 leading-tight">
                  {certError}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-9 bg-zinc-50 hover:bg-zinc-100"
                  onClick={initCerts}
                >
                  <RefreshCw className="size-3.5 mr-1.5" /> Atualizar lista de certificados
                </Button>
                <a
                  href="https://get.webpkiplugin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 py-1"
                >
                  <Download className="size-3.5 text-[#a68845]" /> Instalar extensão Web PKI (1 clique)
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </div>

              <div className="border-t border-zinc-100 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setAuthMethod("credentials")}
                  className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
                >
                  Prefiro entrar com E-mail e Senha
                </button>
              </div>
            </div>
          )}

          {certState === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-xs space-y-3">
              <div className="flex items-start gap-2.5 text-red-900">
                <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Erro ao comunicar com o assinador</p>
                  <p className="mt-1 text-red-700">{certError || "Verifique se o token está conectado e tente novamente."}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs h-9"
                onClick={initCerts}
              >
                <RefreshCw className="size-3.5 mr-1.5" /> Tentar novamente
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="auth-fields">
          {mode === "mfa" ? (
            <>
              <p className="auth-note">
                Enviamos um código para <strong>{email}</strong>. Ele expira em dez minutos.
              </p>
              <label htmlFor="auth-code">Código de confirmação</label>
              <Input
                id="auth-code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="auth-code"
              />
            </>
          ) : mode === "password" ? (
            <>
              <p className="auth-note">Defina uma senha com pelo menos 8 caracteres.</p>
              <label htmlFor="auth-new-password">Nova senha</label>
              <Input
                id="auth-new-password"
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="auth-confirm">Confirmar senha</label>
              <Input
                id="auth-confirm"
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          ) : (
            <>
              <label htmlFor="auth-email">E-mail</label>
              <Input
                id="auth-email"
                type="email"
                required
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
              {mode === "login" && (
                <>
                  <label htmlFor="auth-password">Senha</label>
                  <Input
                    id="auth-password"
                    required
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <p
                    className="auth-note"
                    style={{ fontSize: "0.78rem", marginTop: "0.25rem", lineHeight: "1.3" }}
                  >
                    Primeiro acesso do administrador: informe o e-mail cadastrado e sua nova senha para ativar o acesso.
                  </p>
                </>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="auth-note">
              {message}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy || (mode === "password" && !setupToken)}
            className="login-submit"
          >
            {busy
              ? "Aguarde…"
              : mode === "mfa"
                ? "Confirmar e entrar"
                : mode === "password"
                  ? "Confirmar e-mail e salvar senha"
                  : mode === "request"
                    ? "Enviar link de confirmação"
                    : "Entrar com senha"}
          </Button>

          {mode === "login" ? (
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode("request");
                  setError("");
                }}
              >
                Primeiro acesso ou esqueci minha senha
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod("cert")}
                className="text-xs text-zinc-500 hover:text-zinc-800 inline-flex items-center gap-1"
              >
                <KeyRound className="size-3 text-[#a68845]" /> Entrar com Certificado Digital (Token USB)
              </button>
            </div>
          ) : (
            <button type="button" className="auth-link" disabled={busy} onClick={back}>
              Voltar para o login
            </button>
          )}
        </form>
      )}
    </div>
  );
}

