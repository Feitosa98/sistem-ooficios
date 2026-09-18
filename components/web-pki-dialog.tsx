"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Download,
  Usb,
  Cpu,
  UploadCloud,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Info,
  Building2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { Letter } from "@/lib/letter-types";
import { sameSigner } from "@/lib/signers";
import { createLocalSigner } from "@/lib/local-signer";
const subscribeEnvironment = () => () => {};
const CARTORIO_ROLE_OPTIONS = [
  "Escrevente Autorizado",
  "Escrevente Autorizada",
  "Oficial Substituto",
  "Oficial Substituta",
  "Oficial Registrador",
  "Oficial Registradora",
  "Tabelião de Notas e Oficial Registrador",
  "Tabeliã e Oficial Registradora",
  "Escrevente",
];

export type WebPkiCertificate = {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  validityStart?: string | Date;
  validityEnd?: string | Date;
  pkiBrazil?: {
    cpf?: string;
    cnpj?: string;
    responsavel?: string;
    certificateType?: string;
  };
};

type WebPkiState =
  | "checking"
  | "not_installed"
  | "ready"
  | "signing_start"
  | "signing_pin"
  | "signing_complete"
  | "error";



interface WebPkiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letter: Letter | null;
  onSuccess: (updatedLetter: Letter) => void;

}

interface PkiResult<T> { success(callback: (value: T) => void): PkiResult<T>; error(callback: (message: string) => void): PkiResult<T>; }
interface PkiInstance {
 filters?: { isPkiBrazil: unknown };
 init(options: { ready: () => void; notInstalled: () => void; defaultError: (message: string, error: unknown) => void }): void;
 listCertificates(options?: {filter?: unknown}): PkiResult<WebPkiCertificate[]>;
 readCertificate(thumbprint: string): PkiResult<string>;
 signHash(options: {thumbprint: string; hash: string; digestAlgorithm: string}): PkiResult<string>;
}
declare global {
  interface Window {
    LacunaWebPKI?: new (license?: string) => PkiInstance;
    bry?: unknown;
  }
}

export function WebPkiDialog({
  open,
  onOpenChange,
  letter,
  onSuccess,

}: WebPkiDialogProps) {
  const [activeTab, setActiveTab] = useState<"direct" | "onr">("direct");
  const [engine, setEngine] = useState<"local" | "lacuna">("local");
  const pkiRef = useRef<PkiInstance | null>(null);
  const initializationRef = useRef(0);
  const [state, setState] = useState<WebPkiState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<WebPkiCertificate[]>([]);
  const [selectedThumbprint, setSelectedThumbprint] = useState<string>("");
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string>("");
  const effectiveLicenseKey = engine === "lacuna" ? licenseKey : "";
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Estados do popup de bloqueio de divergência de signatário
  const initialRole = letter?.signerRole || "Escrevente Autorizado";
  const [manualDivergencePopup, setShowDivergencePopup] = useState(false);
  const [divergenceRolePreset, setDivergenceRolePreset] = useState<string>(CARTORIO_ROLE_OPTIONS.includes(initialRole) ? initialRole : "outro");
  const [divergenceCustomRole, setDivergenceCustomRole] = useState<string>(initialRole);
  const [isCustomRole, setIsCustomRole] = useState(!CARTORIO_ROLE_OPTIONS.includes(initialRole));
  const [dismissedThumbprint, setDismissedThumbprint] = useState<string | null>(null);

  // Detecção de ambiente
  const currentHostname = useSyncExternalStore(subscribeEnvironment, () => window.location.hostname, () => "localhost");
  const isLocalhost = ["localhost", "127.0.0.1"].includes(currentHostname);
  const hasBryExtension = useSyncExternalStore(subscribeEnvironment, () => Boolean(window.bry || document.querySelector("[data-bry-content-script-bryweb]")), () => false);

  // Estado da aba ONR
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carrega chave de licença salva e detecta extensões do navegador
  useEffect(() => {
    if (!open) return;

    let active = true;
    fetch("/api/configuracoes/pki")
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.config?.licenseKey) {
          setLicenseKey(data.config.licenseKey);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [open]);

  // Carrega dinamicamente a biblioteca Lacuna Web PKI sem risco de deadlock de eventos antigos
  const ensureScriptLoaded = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window.LacunaWebPKI !== "undefined") {
        resolve();
        return;
      }

      // Remove eventuais tags antigas ou com erro
      const staleScripts = document.querySelectorAll('script[src*="lacuna-web-pki"]');
      staleScripts.forEach((el) => el.remove());

      const script = document.createElement("script");
      script.src = "https://cdn.lacunasoftware.com/libs/web-pki/lacuna-web-pki-2.14.3.min.js";
      script.async = true;
      script.onload = () => {
        if (typeof window.LacunaWebPKI !== "undefined") {
          resolve();
        } else {
          reject(new Error("Biblioteca Web PKI carregada, mas a extensão não foi inicializada."));
        }
      };
      script.onerror = () =>
        reject(
          new Error("Falha ao carregar o script do Web PKI. Verifique sua conexão com a internet.")
        );
      document.head.appendChild(script);
    });
  }, []);

  const signerName = letter?.signerName;
  // Lista certificados com filtro para ICP-Brasil
  const loadCertificates = useCallback((pkiInstance?: PkiInstance) => {
    const pki = pkiInstance || pkiRef.current;
    if (!pki) return;

    setLoadingCerts(true);
    pki
      .listCertificates({
        filter: pki.filters ? pki.filters.isPkiBrazil : undefined,
      })
      .success((certs: WebPkiCertificate[]) => {
        if (pkiRef.current !== pki) return;
        setLoadingCerts(false);
        setCertificates(certs || []);
        if (certs && certs.length > 0) {
          const matching = certs.find(
            (c) =>
              signerName && sameSigner(c.subjectName, signerName)
          );
          setSelectedThumbprint(matching ? matching.thumbprint : certs[0].thumbprint);
        } else {
          setSelectedThumbprint("");
        }
      })
      .error((errorMsg: string) => {
        if (pkiRef.current !== pki) return;
        setLoadingCerts(false);
        if (engine === "local") { setErrorMessage(errorMsg); setState("error"); return; }
        console.warn("Tentando listar sem filtro após erro:", errorMsg);
        pki
          .listCertificates()
          .success((fallbackCerts: WebPkiCertificate[]) => {
            if (pkiRef.current !== pki) return;
            setCertificates(fallbackCerts || []);
            if (fallbackCerts && fallbackCerts.length > 0) {
              setSelectedThumbprint(fallbackCerts[0].thumbprint);
            }
          })
          .error((finalErr: string) => {
            if (pkiRef.current !== pki) return;
            setErrorMessage(finalErr || "Não foi possível ler os certificados na máquina.");
          });
      });
  }, [signerName, engine]);

  // Inicializa o provedor escolhido e ignora retornos de inicializações antigas.
  const initWebPki = useCallback(async () => {
    const generation = ++initializationRef.current;
    pkiRef.current = null;
    setState("checking");
    setErrorMessage(null);
    setCertificates([]);
    setSelectedThumbprint("");
    setShowDivergencePopup(false);
    setDismissedThumbprint(null);

    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    try {
      let pki: PkiInstance;
      if (engine === "local") {
        pki = createLocalSigner(`Ofício nº ${letter?.number || ""}/${letter?.year || ""}`);
      } else {
        await ensureScriptLoaded();
        if (!window.LacunaWebPKI) throw new Error("Web PKI indisponível.");
        pki = new window.LacunaWebPKI(effectiveLicenseKey || undefined);
      }
      if (generation !== initializationRef.current) return;
      pkiRef.current = pki;

      let finished = false;

      // Timeout de segurança para nunca travar a interface
      initTimeoutRef.current = setTimeout(() => {
        if (!finished && generation === initializationRef.current) {
          finished = true;
          console.warn("Tempo de conexão com o assinador encerrado.");
          setState("not_installed");
        }
      }, engine === "local" ? 12000 : 4000);

      pki.init({
        ready: () => {
          if (finished || generation !== initializationRef.current) return;
          finished = true;
          if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
          setState("ready");
          loadCertificates(pki);
        },
        notInstalled: () => {
          if (finished || generation !== initializationRef.current) return;
          finished = true;
          if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
          setState("not_installed");
        },
        defaultError: (message: string, error: unknown) => {
          if (finished || generation !== initializationRef.current) return;
          finished = true;
          if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
          console.error("Falha no assinador:", message, error);
          setErrorMessage(message || "Ocorreu um erro na comunicação com o assinador.");
          setState("error");
        },
      });
    } catch (err) {
      if (generation !== initializationRef.current) return;
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      setErrorMessage(err instanceof Error ? err.message : "Erro ao carregar o assinador.");
      setState("error");
    }
  }, [ensureScriptLoaded, effectiveLicenseKey, loadCertificates, engine, letter?.number, letter?.year]);

  useEffect(() => {
    if (open && activeTab === "direct") void initWebPki();
    return () => {
      ++initializationRef.current;
      pkiRef.current = null;
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    };
  }, [open, activeTab, initWebPki]);

  // Executa assinatura direta (PAdES) em 2 etapas
  async function handleDirectSign(options?: {
    updateSigner?: boolean;
    signerRole?: string;
  }) {
    if (!letter || !selectedThumbprint) return;

    // BLOQUEIO TOTAL: não permite assinar sem alterar o nome do ofício se o certificado for diferente
    if (!isSignerMatching && !options?.updateSigner) {
      setShowDivergencePopup(true);
      toast.warning(
        "Divergência de signatário detectada: é obrigatório alterar o signatário do ofício para liberar a assinatura."
      );
      return;
    }

    const pki = pkiRef.current;
    if (!pki) {
      toast.error("O assinador não está conectado.");
      return;
    }

    try {
      setState("signing_start");

      // 1. Lê somente o certificado público em Base64 pelo provedor selecionado.
      const certContent = await new Promise<string>((resolve, reject) => {
        pki
          .readCertificate(selectedThumbprint)
          .success((content: string) => resolve(content))
          .error((err: string) => reject(new Error(err || "Falha ao ler o certificado digital.")));
      });

      // 2. Chama o backend para preparar o PDF e gerar o hash de assinatura
      const startRes = await fetch(`/api/oficios/${letter.id}/sign-direct/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificate: certContent,
          version: letter.version,
          updateSigner: Boolean(options?.updateSigner),
          signerRole: options?.signerRole,
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData.toSignHash || !startData.sessionToken) {
        if (startData.signerMismatch) {
          setShowDivergencePopup(true);
        }
        throw new Error(startData.error || "Não foi possível preparar o documento para assinatura.");
      }

      // 3. Solicita a assinatura do hash pelo Token (janela de PIN do Windows)
      setState("signing_pin");
      const signature = await new Promise<string>((resolve, reject) => {
        pki
          .signHash({
            thumbprint: selectedThumbprint,
            hash: startData.toSignHash,
            digestAlgorithm: "SHA-256",
          })
          .success((sig: string) => resolve(sig))
          .error((err: string) => {
            reject(
              new Error(
                err.includes("cancel")
                  ? "Assinatura cancelada pelo usuário."
                  : `Falha na assinatura do token: ${err}`
              )
            );
          });
      });

      // 4. Conclui a injeção da assinatura PAdES no PDF e atualiza status
      setState("signing_complete");
      const completeRes = await fetch(`/api/oficios/${letter.id}/sign-direct/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: startData.sessionToken,
          signature,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.letter) {
        throw new Error(completeData.error || "Não foi possível gravar o PDF assinado.");
      }

      toast.success(completeData.message || "Ofício assinado com sucesso!");
      onSuccess(completeData.letter);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro durante o processo de assinatura.";
      toast.error(msg);
      setErrorMessage(msg);
      setState("error");
    }
  }

  // Funções de apoio do fluxo ONR (dentro da mesma tela)
  async function handleDownloadOriginalPdf() {
    if (!letter) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/oficios/${letter.id}/pdf?disposition=attachment`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha ao gerar o PDF do ofício.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oficio-${String(letter.number).padStart(2, "0")}-${letter.year}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF do ofício baixado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleIdentifySignedFile(file: File | null) {
    setSignedFile(null);
    if (!file) return;
    if (file.size < 5 || file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ser um PDF de até 20 MB.");
      return;
    }
    const headerBytes = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
    const headerText = new TextDecoder("latin1").decode(headerBytes);
    if (!headerText.includes("%PDF-")) {
      toast.error("O arquivo selecionado não é um PDF válido.");
      return;
    }
    setSignedFile(file);
    toast.success(`PDF selecionado para validação: ${file.name}`);
  }

  async function handleUploadOnrSigned() {
    if (!letter || !signedFile) {
      toast.error("Selecione o PDF retornado pelo Assinador ONR.");
      return;
    }

    setUploadingSigned(true);
    try {
      const formData = new FormData();
      formData.append("file", signedFile);
      formData.append("provider", "ONR");
      formData.append("version", String(letter.version));

      const res = await fetch(`/api/oficios/${letter.id}/signed-document`, {
        method: "POST",
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok || !payload.letter) {
        throw new Error(payload.error || "Não foi possível salvar o PDF assinado.");
      }

      toast.success("Ofício assinado com sucesso via Assinador ONR!");
      onSuccess(payload.letter);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar PDF assinado.");
    } finally {
      setUploadingSigned(false);
    }
  }

  function cleanSubject(name: string) {
    return name.replace(/^CN=/i, "").split(",")[0].trim();
  }

  function getCertPersonName(subjectName?: string) {
    if (!subjectName) return "";
    const cn = subjectName.replace(/^CN=/i, "").split(",")[0].trim();
    return cn.split(":")[0].trim();
  }

  function getCertDocument(subjectName?: string) {
    if (!subjectName) return null;
    const match = subjectName.match(/:(\d{11,14})/);
    if (!match) return null;
    const doc = match[1];
    if (doc.length === 11) {
      return `CPF: ***.${doc.slice(3, 6)}.${doc.slice(6, 9)}-**`;
    }
    if (doc.length === 14) {
      return `CNPJ: ${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12, 14)}`;
    }
    return doc;
  }

  const isNameCompatible = sameSigner;

  function formatExpiration(dateStr?: string | Date) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return String(dateStr);
    }
  }

  const selectedCert = certificates.find((c) => c.thumbprint === selectedThumbprint);
  const selectedCertName = getCertPersonName(selectedCert?.subjectName);
  const selectedCertDoc = getCertDocument(selectedCert?.subjectName);
  const isSignerMatching = Boolean(
    selectedCertName &&
    letter?.signerName &&
    isNameCompatible(selectedCertName, letter.signerName)
  );

  const isSigning =
    state === "signing_start" || state === "signing_pin" || state === "signing_complete";

  const showDivergencePopup = !isSigning && (manualDivergencePopup || Boolean(selectedThumbprint && selectedCertName && letter?.signerName && !isSignerMatching && dismissedThumbprint !== selectedThumbprint));

  function handleCancelAll() {
    setShowDivergencePopup(false);
    setDismissedThumbprint(null);
    onOpenChange(false);
  }

  function handleDismissDivergence() {
    setDismissedThumbprint(selectedThumbprint);
    setShowDivergencePopup(false);
  }

  async function handleConfirmDivergenceAndSign() {
    const finalRole = isCustomRole
      ? divergenceCustomRole.trim() || "Escrevente Autorizado"
      : divergenceRolePreset;

    setShowDivergencePopup(false);
    setDismissedThumbprint(selectedThumbprint);
    await handleDirectSign({
      updateSigner: true,
      signerRole: finalRole,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSigning && !uploadingSigned) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[#18332e]">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <KeyRound className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Assinatura Digital de Ofício</DialogTitle>
                <DialogDescription className="text-xs">
                  {letter
                    ? `Ofício nº ${String(letter.number).padStart(2, "0")}/${letter.year} · ${letter.signerName}`
                    : "Padrão ICP-Brasil (PAdES)"}
                </DialogDescription>
              </div>
            </div>

            {hasBryExtension && (
              <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800">
                <ShieldCheck className="size-3 text-emerald-600" /> Extensão BRy detectada
              </Badge>
            )}
          </div>

          {/* Abas de seleção de método */}
          <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              disabled={isSigning || uploadingSigned}
              onClick={() => setActiveTab("direct")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${
                activeTab === "direct"
                  ? "bg-white text-[#18332e] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Cpu className="size-3.5" /> Assinar Direto na Web
            </button>
            <button
              type="button"
              disabled={isSigning || uploadingSigned}
              onClick={() => setActiveTab("onr")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${
                activeTab === "onr"
                  ? "bg-white text-[#18332e] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="size-3.5 text-emerald-700" /> Assinador ONR (Cartório)
            </button>
          </div>
        </DialogHeader>

        {/* ========================================================================= */}
        {/* ABA 1: ASSINADOR DIRETO NA WEB (LACUNA WEB PKI) */}
        {/* ========================================================================= */}
        {activeTab === "direct" && (
          <div className="space-y-4 py-1">
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
              <label htmlFor="signer-engine" className="font-medium text-slate-800">Assinador</label>
              <select id="signer-engine" className="w-full rounded-md border border-slate-300 bg-white p-2" value={engine} disabled={isSigning} onChange={event => setEngine(event.target.value as "local" | "lacuna")}>
                <option value="local">Assinador local — Windows, A1 e A3</option>
                <option value="lacuna">Web PKI — licença do domínio</option>
              </select>
              {engine === "local" && <>
                <p className="text-xs leading-5 text-slate-600">Use o certificado A1 instalado no Windows ou conecte o token A3 com o driver do fabricante. Confirme a assinatura na janela do Windows; o PIN será solicitado pelo driver quando necessário.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <a href="/assinador-local.zip" download="assinador-local.zip" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#18332e] px-3 py-2 text-xs font-medium text-white hover:bg-[#234b43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><Download className="size-4" /> Baixar assinador para Windows</a>
                  <a href="/assinador-local.html" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-xs font-medium text-emerald-800 underline">Como instalar no Chrome/Edge</a>
                </div>
              </>}
            </div>
            {engine === "lacuna" && !isLocalhost && !licenseKey && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Licença Web PKI não configurada para {currentHostname}</p>
                <p className="mt-1">Selecione o assinador local acima, configure a licença do Web PKI nas configurações ou utilize a aba Assinador ONR.</p>
              </div>
            )}

            {/* ESTADO: VERIFICANDO */}
            {state === "checking" && (
              <div className="my-6 grid place-items-center py-6 text-center text-sm text-slate-500">
                <Loader2 className="size-8 animate-spin text-[#a68845]" />
                <p className="mt-3 font-medium text-slate-700">Conectando ao assinador...</p>
                <p className="mt-1 text-xs text-slate-400">
                  Lendo certificados instalados e verificando token criptográfico USB.
                </p>
              </div>
            )}

            {/* ESTADO: EXTENSÃO NÃO DETECTADA */}
            {state === "not_installed" && engine === "local" && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">O assinador local não respondeu. Siga as instruções de instalação acima e recarregue a página.</p>
            )}
            {state === "not_installed" && engine === "lacuna" && (
              <div className="space-y-3.5 py-1">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">
                        Extensão Web PKI não detectada neste navegador
                      </p>
                      <p className="mt-1 text-slate-600 leading-relaxed">
                        Para assinar <strong>100% diretamente nesta página</strong> com seu Token A3 ou Certificado A1, é necessário instalar a extensão <strong>Web PKI</strong> (compatível com Chrome, Edge e Firefox).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1 bg-[#18332e] text-white hover:bg-[#234b43]"
                    onClick={() => {
                      window.open("https://get.webpkiplugin.com/", "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Download className="size-4" /> Instalar Web PKI (1 clique)
                    <ExternalLink className="ml-1 size-3 opacity-70" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void initWebPki()}
                    title="Após instalar, clique para verificar novamente"
                  >
                    <RefreshCw className="size-4" /> Já instalei / Verificar
                  </Button>
                </div>

                {hasBryExtension && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                    <p className="font-semibold text-emerald-900">
                      💡 Dica: Extensão de Cartório detectada no seu navegador!
                    </p>
                    <p className="mt-1 text-emerald-800">
                      Seu computador já possui a extensão do <strong>Assinador ONR</strong> instalada. Você não precisa instalar nada novo se preferir assinar pela aba <strong>Assinador ONR (Cartório)</strong> acima!
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2.5 bg-emerald-800 text-white hover:bg-emerald-900 h-7 text-xs"
                      disabled={isSigning || uploadingSigned}
                      onClick={() => setActiveTab("onr")}
                    >
                      Ir para Assinador ONR
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ESTADO: PRONTO (CERTIFICADOS DISPONÍVEIS) */}
            {state === "ready" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Certificado ICP-Brasil detectado:
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500 hover:text-slate-900"
                    onClick={() => loadCertificates()}
                    disabled={loadingCerts}
                  >
                    <RefreshCw className={`size-3 ${loadingCerts ? "animate-spin" : ""}`} />
                    Atualizar certificados
                  </Button>
                </div>

                {certificates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <Usb className="mx-auto size-8 text-slate-400" />
                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      Nenhum certificado digital detectado
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Conecte seu Token USB A3 na máquina ou certifique-se de que seu certificado A1 está instalado no Windows, depois clique em <strong>Atualizar certificados</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {certificates.map((cert) => {
                      const isSelected = cert.thumbprint === selectedThumbprint;
                      return (
                        <button
                          key={cert.thumbprint}
                          type="button"
                          onClick={() => setSelectedThumbprint(cert.thumbprint)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-[#a68845] bg-[#faf7f0] shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {getCertPersonName(cert.subjectName) || cleanSubject(cert.subjectName)}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {getCertDocument(cert.subjectName) ? `${getCertDocument(cert.subjectName)} · ` : ""}
                                Emissor: {cleanSubject(cert.issuerName)}
                              </p>
                            </div>
                            {cert.validityEnd && (
                              <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-slate-600">
                                Val: {formatExpiration(cert.validityEnd)}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedCert && (
                  <div className="space-y-2.5">
                    {/* Quadro de Conferência de Signatário */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Signatário no Ofício
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">
                            {letter?.signerName || "Não especificado"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {letter?.signerRole || "Oficial"}
                          </p>
                        </div>

                        <div className="pt-2 sm:pt-0 sm:pl-3">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Titular do Certificado Digital
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">
                            {selectedCertName || cleanSubject(selectedCert.subjectName)}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {selectedCertDoc ? `${selectedCertDoc} · ` : ""}
                            {cleanSubject(selectedCert.issuerName)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Alerta de Divergência ou Validação Conforme */}
                    {isSignerMatching ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        <div>
                          <span className="font-semibold">Titular confere:</span> O certificado digital selecionado corresponde ao signatário deste ofício.
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 space-y-2.5 shadow-xs">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-amber-950 text-xs">
                              Divergência de Signatário (Assinatura Bloqueada)
                            </p>
                            <p className="text-amber-900 text-[11px] leading-relaxed">
                              O ofício está em nome de <strong>{letter?.signerName}</strong>, mas o certificado selecionado pertence a <strong>{selectedCertName}</strong>.
                            </p>
                            <p className="text-amber-800 text-[11px]">
                              Para prosseguir, é obrigatório atualizar o signatário do ofício para o titular do certificado.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-amber-200/80">
                          <span className="text-[11px] text-amber-800 font-medium">
                            Conformidade ITI / PAdES
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setShowDivergencePopup(true)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 font-semibold shadow-xs"
                          >
                            <AlertTriangle className="mr-1.5 size-3.5" />
                            Ver e Alterar Signatário
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ESTADOS DE ASSINATURA EM ANDAMENTO */}
            {isSigning && (
              <div className="my-6 grid place-items-center py-6 text-center">
                <div className="relative mb-4 grid size-16 place-items-center rounded-2xl bg-amber-50">
                  <Loader2 className="size-8 animate-spin text-[#a68845]" />
                  <Cpu className="absolute size-4 text-[#18332e]" />
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  {state === "signing_start" && "1/3 Preparando documento e gerando hash..."}
                  {state === "signing_pin" && "2/3 Aguardando sua confirmação no Windows..."}
                  {state === "signing_complete" && "3/3 Gravando assinatura digital no PDF..."}
                </p>

                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {state === "signing_pin"
                    ? "Confirme a solicitação na janela do Windows e informe o PIN se o driver solicitar."
                    : "Aplicando os padrões criptográficos e metadados oficiais do cartório."}
                </p>
              </div>
            )}

            {/* ESTADO DE ERRO */}
            {state === "error" && (
              <div className="space-y-4 py-1">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 shrink-0 text-rose-600" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-semibold text-rose-950">Falha no processo de assinatura</p>
                      <p className="mt-1">{errorMessage || "Ocorreu um erro ao comunicar com o certificado digital."}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => void initWebPki()}
                  >
                    <RefreshCw className="size-4" /> Tentar novamente
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={isSigning || uploadingSigned}
                    onClick={() => setActiveTab("onr")}
                  >
                    Usar Assinador ONR
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: ASSINADOR ONR (CARTÓRIO) INTEGRADO */}
        {/* ========================================================================= */}
        {activeTab === "onr" && (
          <div className="space-y-3.5 py-1">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
              <div className="flex items-start gap-2.5">
                <Building2 className="size-4 shrink-0 text-emerald-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">
                    Fluxo Oficial dos Cartórios de Imóveis (ONR)
                  </p>
                  <p className="mt-0.5 text-slate-600 leading-relaxed">
                    Utiliza a extensão oficial <strong>BRy</strong> e o seu <strong>Token A3</strong> com carimbo do tempo ICP-Brasil gratuito da ONR.
                  </p>
                </div>
              </div>
            </div>

            {/* Passos 1 e 2 */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="grid size-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold">1</span>
                  Baixar PDF do Ofício
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Gera o PDF com cabeçalho oficial pronto para assinatura.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2.5 w-full text-xs"
                  onClick={handleDownloadOriginalPdf}
                  disabled={downloadingPdf}
                >
                  <Download className="mr-1 size-3.5" />
                  {downloadingPdf ? "Baixando..." : "Baixar PDF original"}
                </Button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="grid size-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold">2</span>
                  Assinar no Portal ONR
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Abre o portal oficial onde sua extensão BRy solicita o PIN.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2.5 w-full bg-emerald-700 text-white hover:bg-emerald-800 text-xs"
                  onClick={() => {
                    window.open("https://assinador.onr.org.br/", "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="mr-1 size-3.5" /> Abrir Assinador ONR
                </Button>
              </div>
            </div>

            {/* Passo 3: Dropzone do PDF assinado */}
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="grid size-4 place-items-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">3</span>
                Anexar o PDF Assinado retornado pelo ONR
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Arraste o arquivo assinado pelo ONR para a área abaixo:
              </p>

              <label
                className={`mt-2.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-xs transition ${
                  signedFile
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-slate-300 bg-slate-50 text-slate-600 hover:border-[#a68845] hover:bg-[#faf7ef]"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleIdentifySignedFile(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                {signedFile ? (
                  <FileCheck2 className="size-5 shrink-0 text-emerald-700" />
                ) : (
                  <UploadCloud className="size-5 shrink-0 text-[#8a7135]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {signedFile ? signedFile.name : "Selecionar ou arrastar PDF assinado aqui"}
                  </span>
                  {signedFile && (
                    <span className="mt-0.5 block text-[10px] text-emerald-700">
                      PDF válido · {(signedFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    void handleIdentifySignedFile(e.target.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              {signedFile && (
                <Button
                  type="button"
                  className="mt-2.5 w-full bg-emerald-700 text-white hover:bg-emerald-800 text-xs"
                  onClick={handleUploadOnrSigned}
                  disabled={uploadingSigned}
                >
                  {uploadingSigned ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Gravando documento assinado...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1.5 size-3.5" /> Concluir e salvar ofício assinado
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PAINEL DE DIAGNÓSTICO RETRÁTIL */}
        {/* ========================================================================= */}
        <div className="border-t border-slate-100 pt-2 text-[11px]">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex w-full items-center justify-between py-1 text-slate-400 hover:text-slate-600"
          >
            <span className="flex items-center gap-1">
              <Info className="size-3" /> Diagnóstico técnico do ambiente
            </span>
            {showDiagnostics ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {showDiagnostics && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Endereço de acesso:</span>
                <strong className="text-slate-800">{currentHostname} ({isLocalhost ? "Local" : "Rede"})</strong>
              </div>
              <div className="flex justify-between">
                <span>Extensão de Cartório (BRy):</span>
                <strong className={hasBryExtension ? "text-emerald-700" : "text-slate-500"}>
                  {hasBryExtension ? "Detectada (Ativa)" : "Não detectada"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>{engine === "local" ? "Assinador local:" : "Web PKI:"}</span>
                <strong className={state === "ready" ? "text-emerald-700" : "text-amber-700"}>
                  {state === "ready" ? "Pronto" : state}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Certificados encontrados:</span>
                <strong className="text-slate-800">{certificates.length}</strong>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RODAPÉ */}
        {/* ========================================================================= */}
        <DialogFooter className="mt-2 flex-row justify-between border-t border-slate-100 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSigning || uploadingSigned}
          >
            Cancelar
          </Button>

          {activeTab === "direct" && state === "ready" && (
            <>
              {isSignerMatching ? (
                <Button
                  type="button"
                  disabled={!selectedThumbprint || certificates.length === 0 || isSigning}
                  onClick={() => void handleDirectSign()}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  <CheckCircle2 className="size-4" />
                  Assinar como {selectedCertName || letter?.signerName || "Signatário"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!selectedThumbprint || certificates.length === 0 || isSigning}
                  onClick={() => setShowDivergencePopup(true)}
                  className="bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                >
                  <AlertTriangle className="size-4 mr-1.5" />
                  Divergência: Altere o Signatário para Assinar
                </Button>
              )}
            </>
          )}
        </DialogFooter>

        {/* ========================================================================= */}
        {/* POPUP BLOQUEANTE DE DIVERGÊNCIA DE SIGNATÁRIO */}
        {/* ========================================================================= */}
        {showDivergencePopup && (
          <div
            className="absolute inset-0 z-50 flex flex-col justify-between rounded-lg bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-y-auto"
            role="alertdialog"
            aria-modal="true"
          >
            {/* Botão Fechar no Topo */}
            <button
              type="button"
              onClick={handleCancelAll}
              className="absolute top-4 right-4 rounded-xs p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Cancelar e fechar"
            >
              <X className="size-4" />
              <span className="sr-only">Fechar</span>
            </button>

            <div>
              {/* Cabeçalho do Popup */}
              <div className="flex items-start gap-3.5 pr-6">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                  <AlertTriangle className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Divergência de Signatário Detectada
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Não é permitido assinar o documento com signatário divergente do certificado digital.
                    Para prosseguir, o ofício será atualizado com os dados do titular do certificado.
                  </p>
                </div>
              </div>

              {/* Comparativo de Alteração: Antes x Depois */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  {/* Atual no Ofício */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-rose-500 inline-block" />
                      Signatário Atual no Ofício
                    </p>
                    <p className="text-xs font-semibold text-rose-900 line-through decoration-rose-400 decoration-2">
                      {letter?.signerName || "Não especificado"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {letter?.signerRole || "Função atual"}
                    </p>
                  </div>

                  {/* Novo Signatário (Certificado) */}
                  <div className="pt-2 sm:pt-0 sm:pl-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                      Novo Signatário (Certificado)
                    </p>
                    <p className="text-xs font-bold text-emerald-950">
                      {selectedCertName || "Titular do Certificado"}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {selectedCertDoc ? `${selectedCertDoc} · ` : ""}
                      {selectedCert ? cleanSubject(selectedCert.issuerName) : "ICP-Brasil"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seletor de Cargo / Função */}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold text-slate-800 block">
                  Cargo / Função de <span className="text-emerald-800 font-bold">{selectedCertName}</span> no cartório:
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  value={isCustomRole ? "outro" : divergenceRolePreset}
                  onChange={(e) => {
                    if (e.target.value === "outro") {
                      setIsCustomRole(true);
                    } else {
                      setIsCustomRole(false);
                      setDivergenceRolePreset(e.target.value);
                    }
                  }}
                >
                  {CARTORIO_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  <option value="outro">Outro cargo / função personalizada...</option>
                </select>

                {isCustomRole && (
                  <input
                    type="text"
                    placeholder="Digite o cargo (ex: Escrevente Designado)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                    value={divergenceCustomRole}
                    onChange={(e) => setDivergenceCustomRole(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              {/* Aviso normativo de conformidade ITI */}
              <div className="mt-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 p-2.5 text-[11px] text-amber-950 flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 text-amber-700 mt-0.5" />
                <p className="leading-snug text-slate-600">
                  O ofício impresso e o carimbo digital padrão Adobe/Foxit serão gerados em nome de{" "}
                  <strong className="text-slate-900">{selectedCertName}</strong>, garantindo conformidade com o ITI e validade jurídica plena.
                </p>
              </div>
            </div>

            {/* Botões de Ação do Popup */}
            <div className="mt-5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
              <div className="flex w-full sm:w-auto items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-initial text-xs text-slate-600 hover:bg-slate-100"
                  onClick={handleCancelAll}
                >
                  Cancelar
                </Button>
                {certificates.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 sm:flex-initial text-xs text-slate-600 hover:text-slate-900"
                    onClick={handleDismissDivergence}
                  >
                    Trocar Certificado
                  </Button>
                )}
              </div>
              <Button
                type="button"
                className="w-full sm:w-auto bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold shadow-md px-4"
                onClick={() => void handleConfirmDivergenceAndSign()}
              >
                <CheckCircle2 className="size-4 mr-1.5" />
                Atualizar Ofício e Assinar Agora
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
