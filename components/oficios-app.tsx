"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BookOpenText,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FilePenLine,
  Files,
  Hash,
  Inbox,
  LayoutDashboard,
  Loader2,
  KeyRound,
  Mail,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PenLine,
  Plus,
  Printer,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UploadCloud,
  UserRoundCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import type { Letter } from "@/lib/letter-types";
import type { AccessUser } from "@/lib/access";
import { signers } from "@/lib/signers";
import { AccessSettings } from "@/components/access-settings";
import { LogoutButton } from "./logout-button";
import { WebPkiDialog } from "@/components/web-pki-dialog";

type View = "overview" | "letters" | "templates" | "settings";
type LetterStatus =
  | "Rascunho"
  | "Em revisão"
  | "Assinado"
  | "Enviado"
  | "Arquivado";

type DraftLetter = Omit<
  Letter,
  | "id"
  | "version"
  | "signedFileKey"
  | "signedFileName"
  | "signedFileSize"
  | "signedAt"
  | "sentAt"
  | "signatureProvider"
  | "createdAt"
  | "updatedAt"
>;
type TemplateKey =
  | "obitos"
  | "emolumentos"
  | "resposta-vara"
  | "resposta-matricula"
  | "resposta-semhab"
  | "livre";
type SignatureProvider = "ONR" | "Adobe Acrobat";

type ManualTemplate = {
  id: number;
  title: string;
  description: string;
  department: string;
  subject: string;
  recipient: string;
  recipientRole: string;
  salutation: string;
  body: string;
  closing: string;
  sourceFileName: string;
  sourceFileType: string;
  sourceFileSize: number;
  createdAt: string;
};

type EmailRecipient = {
  id: number;
  name: string;
  organization: string;
  email: string;
  createdAt: string;
};

const statuses: LetterStatus[] = [
  "Rascunho",
  "Em revisão",
  "Assinado",
  "Enviado",
  "Arquivado",
];

const editableStatuses: LetterStatus[] = [
  "Rascunho",
  "Em revisão",
  "Enviado",
  "Arquivado",
];

const initialStatuses: LetterStatus[] = ["Rascunho", "Em revisão"];

const templates = [
  {
    key: "obitos" as TemplateKey,
    title: "Comunicação mensal de óbitos",
    description:
      "Modelo padronizado para informar à Junta Militar os registros realizados no mês.",
    source: "Baseado no Ofício nº 159/2026",
    icon: CalendarDays,
  },
  {
    key: "emolumentos" as TemplateKey,
    title: "Providência judicial e emolumentos",
    description:
      "Resposta ao Juízo para solicitar recolhimento de emolumentos e regular prosseguimento.",
    source: "Baseado no Ofício nº 169/2026",
    icon: ShieldCheck,
  },
  {
    key: "resposta-vara" as TemplateKey,
    title: "Resposta judicial - pesquisa negativa",
    description:
      "Resposta ao Juízo após pesquisa no Indicador Pessoal e no Indicador Real.",
    source: "Baseado no Ofício nº 56/2026 - 2ª Vara",
    icon: ClipboardCheck,
  },
  {
    key: "resposta-matricula" as TemplateKey,
    title: "Resposta sobre matrícula e contribuinte",
    description:
      "Resposta institucional quando a matrícula indicada não pertence ao interessado informado.",
    source: "Baseado no Ofício nº 143/2026 - PGFN",
    icon: Search,
  },
  {
    key: "resposta-semhab" as TemplateKey,
    title: "Resposta à SEMHAB - imóvel não localizado",
    description:
      "Resposta a solicitação municipal após pesquisa negativa do imóvel e dos interessados.",
    source: "Baseado no Ofício nº 97/2026 - SEMHAB",
    icon: Building2,
  },
  {
    key: "livre" as TemplateKey,
    title: "Ofício livre",
    description:
      "Estrutura institucional limpa para assuntos que ainda não possuem modelo próprio.",
    source: "Cabeçalho, fecho e rodapé padronizados",
    icon: FilePenLine,
  },
];

const navItems = [
  { key: "overview" as View, label: "Visão geral", icon: LayoutDashboard },
  { key: "letters" as View, label: "Ofícios", icon: Files },
  { key: "templates" as View, label: "Modelos", icon: BookOpenText },
  { key: "settings" as View, label: "Configurações", icon: Settings2 },
];

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyDraft(nextNumber: number): DraftLetter {
  return {
    number: nextNumber,
    year: new Date().getFullYear(),
    suffix: "2ºREG/AM",
    issueDate: todayInput(),
    department: "RI/RTDPJ",
    subject: "",
    reference: "",
    recipient: "",
    recipientEmail: "",
    recipientRole: "",
    salutation: "Prezado(a),",
    body: "",
    closing:
      "Sem outro assunto para o momento, renovamos votos de elevada estima e consideração.",
    signerName: "Marcellus Mozart Silva Batista",
    signerRole: "Oficial Substituto",
    status: "Rascunho",
    notes: "",
  };
}

function applyTemplate(key: TemplateKey, nextNumber: number): DraftLetter {
  const draft = emptyDraft(nextNumber);
  if (key === "obitos") {
    return {
      ...draft,
      department: "RCPN",
      subject: "Comunicação de Registro de óbito",
      recipient: "À JUNTA MILITAR DO MUNICÍPIO DE MANACAPURU - AM.",
      body:
        "Venho pelo presente informar os registros de óbitos realizados por esta Serventia Extrajudicial referentes ao mês de [MÊS]/[ANO], conforme relação anexa.",
      closing:
        "Nada mais, aproveito a oportunidade para apresentar protestos de consideração.",
      signerName: "Késsila Tayná Ambrózio da Silva",
      signerRole: "Escrevente Autorizada",
    };
  }
  if (key === "emolumentos") {
    return {
      ...draft,
      suffix: "2ºREG/AM",
      department: "RCPN",
      subject: "Registro de Interdição",
      reference: "Processo nº [NÚMERO DO PROCESSO]",
      recipient: "A Excelentíssima Senhora",
      recipientRole:
        "Juíza de Direito da 2ª Vara da Comarca de Manacapuru/AM\nDoutora [NOME DA MAGISTRADA]",
      salutation: "Excelentíssima Senhora Doutora,",
      body:
        "Em atenção à sentença proferida nos autos do processo em epígrafe, com os cordiais cumprimentos, informamos a Vossa Excelência que, para a realização do registro solicitado, faz-se necessário o recolhimento dos emolumentos cartorários no valor de R$ [VALOR] ([VALOR POR EXTENSO]).\n\nEsclarecemos que o referido valor corresponde ao ato registral e que não consta nos autos o deferimento da gratuidade em relação aos emolumentos cartorários.\n\nDessa forma, para viabilizar o regular prosseguimento do procedimento e o cumprimento integral da determinação judicial, esta Serventia requer, respeitosamente, que seja determinada a intimação da parte interessada para providenciar o recolhimento e adotar as medidas necessárias ao registro.",
      closing:
        "Sem outro assunto para o momento, renovo os votos da mais elevada estima, consideração e apreço.",
      signerName: "Késsila Tayná Ambrózio da Silva",
      signerRole: "Escrevente Autorizada",
    };
  }
  if (key === "resposta-vara") {
    return {
      ...draft,
      subject: "Ofício Resposta",
      reference: "Processo nº [NÚMERO DO PROCESSO]",
      recipient: "A Ilustríssima Senhora",
      recipientRole:
        "Dra. [NOME DA MAGISTRADA]\nMM. Juíza de Direito - Titular da [VARA] da Comarca de Manacapuru/AM",
      salutation: "Senhora Juíza,",
      body:
        "Cumprimentando-a cordialmente e, em atenção à decisão expedida por esse Juízo nos autos do processo em referência, no qual são solicitadas informações referentes a [OBJETO DA PESQUISA], venho expor:\n\nApós a realização de buscas em nosso sistema, notadamente no Indicador Pessoal, nos termos do art. 173, inciso V, da Lei nº 6.015/73, em nome de [NOME(S) PESQUISADO(S)], e no Indicador Real, nos termos do art. 173, inciso IV, da Lei nº 6.015/73, quanto ao imóvel situado em [ENDEREÇO/IDENTIFICAÇÃO DO IMÓVEL], não foi localizado qualquer registro ou lançamento, resultando negativa a pesquisa.",
      closing:
        "Sendo o que cumpria informar, coloco-me à disposição para quaisquer esclarecimentos adicionais que se fizerem necessários.",
      signerName: "Lucas do Espírito Santo Ribeiro",
      signerRole: "Escrevente Autorizado",
    };
  }
  if (key === "resposta-matricula") {
    return {
      ...draft,
      subject: "Resposta à solicitação de matrícula de imóvel",
      reference: "Processo nº [NÚMERO DO PROCESSO]",
      recipient: "À [ÓRGÃO DESTINATÁRIO]",
      recipientRole: "A/C: [NOME E CARGO DO DESTINATÁRIO]",
      salutation: "Vossa Senhoria,",
      body:
        "Em atenção ao expediente datado de [DATA], por meio do qual foi solicitada a remessa da matrícula de imóvel nº [MATRÍCULA], supostamente pertinente ao contribuinte [NOME DO INTERESSADO], inscrito no CPF/CNPJ sob o nº [CPF/CNPJ], informamos que, após pesquisa realizada tanto no acervo do antigo 1º Ofício de Manacapuru/AM, atualmente incorporado a esta Serventia, quanto no acervo do 2º Ofício de Manacapuru/AM, constatou-se que a referida matrícula não consta e nunca constou em nome do mencionado contribuinte.",
      closing:
        "Sem mais para o momento, renovamos protestos de elevada estima e consideração.",
      signerName: "Altair Ferreira Thury Neto",
      signerRole: "Escrevente Autorizado",
    };
  }
  if (key === "resposta-semhab") {
    return {
      ...draft,
      subject: "Resposta ao Ofício nº [NÚMERO/ANO/ÓRGÃO]",
      recipient:
        "À Secretaria Municipal de Habitação e Assuntos Fundiários - SEMHAB",
      salutation: "Prezado(a),",
      body:
        "Em atenção ao Ofício nº [NÚMERO/ANO/ÓRGÃO], datado de [DATA], expedido por essa Secretaria, que solicita informações acerca de eventual registro de imóvel em nome de [NOME/RAZÃO SOCIAL], inscrito(a) no CPF/CNPJ sob o nº [CPF/CNPJ], cumpre esclarecer que, após as devidas pesquisas realizadas nos Livros de Registro de Imóveis a cargo desta Serventia, não foi localizado o imóvel situado em [ENDEREÇO/LOCALIZAÇÃO DO IMÓVEL], neste município de Manacapuru/AM.",
      closing: "Cordialmente,",
      signerName: "Altair Ferreira Thury Neto",
      signerRole: "Escrevente Autorizado",
    };
  }
  return draft;
}

function formatLetterNumber(letter: Pick<Letter, "number" | "year" | "suffix">) {
  return `${String(letter.number).padStart(2, "0")}/${letter.year}${
    letter.suffix ? ` - ${letter.suffix}` : ""
  }`;
}

function formatLongDate(value: string) {
  if (!value) return "[DATA]";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatShortDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function formatSentDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Manaus",
  }).format(new Date(normalized));
}

function formatHeaderDate() {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function statusClasses(status: LetterStatus) {
  const map: Record<LetterStatus, string> = {
    Rascunho: "border-slate-200 bg-slate-50 text-slate-700",
    "Em revisão": "border-amber-200 bg-amber-50 text-amber-800",
    Assinado: "border-violet-200 bg-violet-50 text-violet-800",
    Enviado: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Arquivado: "border-stone-200 bg-stone-100 text-stone-700",
  };
  return map[status];
}

function LetterPreview({ letter }: { letter: DraftLetter | Letter }) {
  return (
    <article className="letter-sheet print-area">
      <Image
        src="/logo-cartorio.jpg"
        alt="Cartório 2º Ofício de Manacapuru"
        className="letter-logo"
        width={499}
        height={295}
        priority
        unoptimized
      />
      <Image
        src="/marca-dagua-cartorio.png"
        alt=""
        aria-hidden="true"
        className="letter-watermark"
        width={2040}
        height={1242}
        unoptimized
      />
      <header className="letter-heading">
        <p>ESTADO DO AMAZONAS</p>
        <p>CARTÓRIO EXTRAJUDICIAL</p>
        <p>2º OFÍCIO DE MANACAPURU - AM</p>
        <p>PAULO HENRIQUE FELBERK DE ALMEIDA</p>
        <p>OFICIAL REGISTRADOR</p>
      </header>
      <main className="letter-content">
        <h2>OFÍCIO Nº {formatLetterNumber(letter)}</h2>
        <div className="letter-meta">
          {letter.subject && (
            <p>
              <strong>Assunto:</strong> {letter.subject}
            </p>
          )}
          {letter.reference && (
            <p>
              <strong>Referência:</strong> {letter.reference}
            </p>
          )}
        </div>
        <div className="letter-recipient">
          <p>{letter.recipient || "[DESTINATÁRIO]"}</p>
          {letter.recipientRole && <p>{letter.recipientRole}</p>}
        </div>
        <p className="letter-salutation">{letter.salutation || "Prezado(a),"}</p>
        <div className="letter-body">
          {letter.body || "[Redija aqui o conteúdo do ofício.]"}
        </div>
        <p className="letter-closing">{letter.closing}</p>
        <p className="letter-date">
          Manacapuru - AM, {formatLongDate(letter.issueDate)}.
        </p>
        <div className="letter-signature">
          <p>{letter.signerName}</p>
          <p>{letter.signerRole}</p>
        </div>
      </main>
      <footer className="letter-footer">
        <p>Av. Ribeiro Júnior, nº 373, Centro, Manacapuru/AM - CEP 69.400-366</p>
        <p>RI/RTDPJ: ri.tdpj2oficio@gmail.com · RCPN: rcpn2oficio@gmail.com</p>
      </footer>
    </article>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {children}
    </label>
  );
}

export default function OficiosApp({ user }: { user: AccessUser }) {
  const currentYear = new Date().getFullYear();
  const [activeView, setActiveView] = useState<View>("overview");
  const [letters, setLetters] = useState<Letter[]>([]);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [summary, setSummary] = useState({ total: 0, nextNumber: 1, counts: {} as Record<LetterStatus, number>, recentLetters: [] as Letter[] });
  function updateLetters(update: (current: Letter[]) => Letter[]) { setLetters(update); setRefreshToken((value) => value + 1); }
  const [manualTemplates, setManualTemplates] = useState<ManualTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateForm, setTemplateForm] = useState({
    title: "",
    description: "",
    department: "RI/RTDPJ",
    subject: "",
    recipient: "",
    salutation: "Prezado(a),",
    body: "",
    closing:
      "Sem outro assunto para o momento, renovamos votos de elevada estima e consideração.",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [emailRecipientsLoading, setEmailRecipientsLoading] = useState(true);
  const currentUser = user;
  const [savingEmailRecipient, setSavingEmailRecipient] = useState(false);
  const [savingDraftRecipient, setSavingDraftRecipient] = useState(false);
  const [emailRecipientForm, setEmailRecipientForm] = useState({
    name: "",
    organization: "",
    email: "",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<
    "normal" | "maximized" | "minimized"
  >("normal");
  const [previewLetter, setPreviewLetter] = useState<Letter | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState<"normal" | "maximized">("normal");
  const [previewTab, setPreviewTab] = useState<"pdf" | "text">("pdf");
  const previewDialogRef = useRef<HTMLDivElement | null>(null);
  const [signatureLetter, setSignatureLetter] = useState<Letter | null>(null);
  const [signatureProvider, setSignatureProvider] =
    useState<SignatureProvider>("ONR");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [emailLetter, setEmailLetter] = useState<Letter | null>(null);
  const [emailPrepared, setEmailPrepared] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState({
    recipient: "",
    subject: "",
    body: "",
  });
  const [emailConfigForm, setEmailConfigForm] = useState({
    provider: "smtp" as "smtp" | "resend",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: "",
    pass: "",
    from: "ri.tdpj2oficio@gmail.com",
    fromName: "2º Ofício de Manacapuru/AM",
    passConfigured: false,
    hasApiKey: false,
    apiKey: "",
  });
  const [loadingEmailConfig, setLoadingEmailConfig] = useState(true);
  const [savingEmailConfig, setSavingEmailConfig] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [draft, setDraft] = useState<DraftLetter>(() => emptyDraft(1));
  const [editingVersion, setEditingVersion] = useState(1);
  const [editingLetterId, setEditingLetterId] = useState<number | null>(null);
  const [webPkiOpen, setWebPkiOpen] = useState(false);
  const [webPkiLetter, setWebPkiLetter] = useState<Letter | null>(null);
  const [pkiConfig, setPkiConfig] = useState({ licenseKey: "", restPkiToken: "", restPkiTokenConfigured: false, certificateValidationConfigured: false });
  const [loadingPkiConfig, setLoadingPkiConfig] = useState(false);
  const [savingPkiConfig, setSavingPkiConfig] = useState(false);


  function openLetterPreview(letter: Letter, initialTab?: "pdf" | "text") {
    setPreviewPosition(null);
    setPreviewMode("normal");
    setPreviewTab(initialTab || (letter.signedFileKey ? "pdf" : "text"));
    setPreviewLetter(letter);
  }

  function closeLetterPreview() {
    setPreviewLetter(null);
    setPreviewPosition(null);
    setPreviewMode("normal");
  }

  function startPreviewDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (previewMode === "maximized") return;
    if (event.button !== 0 || window.innerWidth < 768) return;
    if ((event.target as HTMLElement).closest("button, a, input, [role='menuitem'], [role='tab']")) return;

    const dialog = previewDialogRef.current;
    if (!dialog) return;

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = dialog.getBoundingClientRect();
    const margin = 12;

    document.body.style.userSelect = "none";

    const move = (moveEvent: PointerEvent) => {
      const requestedX = moveEvent.clientX - startX;
      const requestedY = moveEvent.clientY - startY;
      const deltaX = Math.min(
        window.innerWidth - margin - rect.right,
        Math.max(margin - rect.left, requestedX),
      );
      const deltaY = Math.min(
        window.innerHeight - margin - rect.bottom,
        Math.max(margin - rect.top, requestedY),
      );

      setPreviewPosition({
        left: rect.left + deltaX + rect.width / 2,
        top: rect.top + deltaY + rect.height / 2,
      });
    };

    const stop = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: search, status: statusFilter, page: String(page), pageSize: "50" });
        const response = await fetch("/api/oficios?" + params, { signal: abort.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar ofícios.");
        if (!abort.signal.aborted) { setLetters(payload.letters); setSummary(payload); }
      } catch (error) { if (!abort.signal.aborted) toast.error(error instanceof Error ? error.message : "Erro ao carregar acervo."); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, statusFilter, page, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/destinatarios-email", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          recipients?: EmailRecipient[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar e-mails");
        if (!cancelled) setEmailRecipients(payload.recipients ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar os e-mails cadastrados.");
      })
      .finally(() => {
        if (!cancelled) setEmailRecipientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (user.role !== "admin") return;
    fetch("/api/configuracoes/email", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          config?: {
            provider: "smtp" | "resend";
            host: string;
            port: number;
            secure: boolean;
            user: string;
            passConfigured: boolean;
            from: string;
            fromName: string;
            hasApiKey: boolean;
          };
        };
        if (!cancelled && payload.config) {
          setEmailConfigForm((current) => ({
            ...current,
            ...payload.config,
            pass: "",
            apiKey: "",
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingEmailConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  async function saveEmailConfigSubmit(event: FormEvent) {
    event.preventDefault();
    setSavingEmailConfig(true);
    try {
      const response = await fetch("/api/configuracoes/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailConfigForm),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        config?: typeof emailConfigForm;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Não foi possível salvar as configurações.");
      }
      setEmailConfigForm((current) => ({
        ...current,
        ...(payload.config ?? {}),
        pass: "",
        apiKey: "",
      }));
      toast.success("Configurações de e-mail salvas com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar configurações de e-mail.",
      );
    } finally {
      setSavingEmailConfig(false);
    }
  }

  async function testEmailSubmit() {
    const target = testEmailAddress.trim();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      toast.error("Informe um endereço de e-mail válido para o teste.");
      return;
    }
    setTestingEmail(true);
    try {
      const response = await fetch("/api/configuracoes/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", targetEmail: target }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Falha no envio do e-mail de teste.");
      }
      toast.success(payload.message || `E-mail de teste enviado para ${target}!`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar e-mail de teste.",
      );
    } finally {
      setTestingEmail(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPkiConfig() {
      setLoadingPkiConfig(true);
      try {
        const response = await fetch("/api/configuracoes/pki");
        const payload = (await response.json()) as {
          config?: { licenseKey?: string; restPkiTokenConfigured?: boolean; certificateValidationConfigured?: boolean };
        };
        if (!cancelled && payload?.config) {
          setPkiConfig({
            licenseKey: payload.config.licenseKey || "",
            restPkiToken: "",
            restPkiTokenConfigured: Boolean(payload.config.restPkiTokenConfigured),
            certificateValidationConfigured: Boolean(payload.config.certificateValidationConfigured),
          });
        }
      } catch {
        // fallback
      } finally {
        if (!cancelled) setLoadingPkiConfig(false);
      }
    }
    void loadPkiConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePkiConfigSubmit(event: FormEvent) {
    event.preventDefault();
    setSavingPkiConfig(true);
    try {
      const response = await fetch("/api/configuracoes/pki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pkiConfig),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Não foi possível salvar as configurações do Web PKI.");
      }
      setPkiConfig((current) => ({ ...current, restPkiToken: "", restPkiTokenConfigured: Boolean(current.restPkiToken) || current.restPkiTokenConfigured }));
      toast.success("Configurações do Web PKI salvas com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    } finally {
      setSavingPkiConfig(false);
    }
  }

  function openWebPkiSign(letter: Letter) {
    setWebPkiLetter(letter);
    setWebPkiOpen(true);
  }

  function handleWebPkiSuccess(updatedLetter: Letter) {
    updateLetters((current) =>
      current.map((item) => (item.id === updatedLetter.id ? updatedLetter : item)),
    );
    if (previewLetter?.id === updatedLetter.id) {
      setPreviewLetter(updatedLetter);
      setPreviewTab("pdf");
    }
  }

  async function saveEmailRecipient(event: FormEvent) {
    event.preventDefault();
    if (!emailRecipientForm.name.trim() || !emailRecipientForm.email.trim()) {
      toast.error("Informe o nome e o e-mail do destinatário.");
      return;
    }
    setSavingEmailRecipient(true);
    try {
      const response = await fetch("/api/destinatarios-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailRecipientForm),
      });
      const payload = (await response.json()) as {
        recipient?: EmailRecipient;
        error?: string;
      };
      if (!response.ok || !payload.recipient) {
        throw new Error(payload.error || "Não foi possível cadastrar o e-mail.");
      }
      setEmailRecipients((current) =>
        [...current, payload.recipient!].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      setEmailRecipientForm({ name: "", organization: "", email: "" });
      toast.success("Destinatário de e-mail cadastrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar e-mail.");
    } finally {
      setSavingEmailRecipient(false);
    }
  }

  async function deleteEmailRecipient(recipient: EmailRecipient) {
    try {
      const response = await fetch(`/api/destinatarios-email/${recipient.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir.");
      setEmailRecipients((current) => current.filter((item) => item.id !== recipient.id));
      toast.success("E-mail removido do cadastro.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir e-mail.");
    }
  }

  async function saveDraftRecipient() {
    const name = draft.recipient.trim();
    const email = draft.recipientEmail.trim().toLowerCase();
    const organization = draft.recipientRole.trim();
    if (!name) {
      toast.error("Informe o nome do destinatário para cadastrar.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido para cadastrar o destinatário.");
      return;
    }

    const exists = emailRecipients.some((item) => item.email.toLowerCase() === email);
    if (exists) {
      toast.info("Este e-mail já está cadastrado na lista de destinatários.");
      return;
    }

    setSavingDraftRecipient(true);
    try {
      const response = await fetch("/api/destinatarios-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, organization, email }),
      });
      const payload = (await response.json()) as { recipient?: EmailRecipient; error?: string };
      if (!response.ok || !payload.recipient) {
        throw new Error(payload.error || "Não foi possível cadastrar o destinatário.");
      }
      setEmailRecipients((current) =>
        [...current, payload.recipient!].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      toast.success("Destinatário cadastrado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar destinatário.");
    } finally {
      setSavingDraftRecipient(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/modelos", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          templates?: ManualTemplate[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar modelos");
        if (!cancelled) setManualTemplates(payload.templates ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar os modelos manuais.");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nextNumber = summary.nextNumber;
  const filteredLetters = letters;
  const counts = Object.fromEntries(statuses.map((status) => [status, summary.counts[status] || 0])) as Record<LetterStatus, number>;

  function openComposer(template: TemplateKey = "livre") {
    setEditingLetterId(null);
    setDraft(applyTemplate(template, nextNumber));
    setComposerMode("normal");
    setComposerOpen(true);
  }

  function openManualTemplate(template: ManualTemplate) {
    setEditingLetterId(null);
    const draft = emptyDraft(nextNumber);
    setDraft({
      ...draft,
      department: template.department || draft.department,
      subject: template.subject || template.title,
      recipient: template.recipient || "[DESTINATÁRIO]",
      recipientRole: template.recipientRole || "",
      salutation: template.salutation || draft.salutation,
      body: template.body || "[ADAPTE O CONTEÚDO CONFORME O ARQUIVO DE REFERÊNCIA]",
      closing: template.closing || draft.closing,
    });
    setComposerMode("normal");
    setComposerOpen(true);
  }

  function openEditLetter(letter: Letter) {
    if (letter.signedFileKey || (letter.status !== "Rascunho" && letter.status !== "Em revisão")) {
      toast.error("Ofícios assinados, enviados ou arquivados não podem ter seu conteúdo editado.");
      return;
    }
    setEditingLetterId(letter.id);
    setEditingVersion(letter.version);
    setDraft({
      number: letter.number,
      year: letter.year,
      suffix: letter.suffix,
      issueDate: letter.issueDate || todayInput(),
      department: letter.department || "RI/RTDPJ",
      subject: letter.subject || "",
      reference: letter.reference || "",
      recipient: letter.recipient || "",
      recipientEmail: letter.recipientEmail || "",
      recipientRole: letter.recipientRole || "",
      salutation: letter.salutation || "Prezado(a),",
      body: letter.body || "",
      closing: letter.closing || "",
      signerName: letter.signerName || "",
      signerRole: letter.signerRole || "",
      status: letter.status,
      notes: letter.notes || "",
    });
    setComposerMode("normal");
    setComposerOpen(true);
  }

  async function saveManualTemplate(event: FormEvent) {
    event.preventDefault();
    if (!templateForm.title.trim() || !templateFile) {
      toast.error("Informe o nome e selecione o arquivo do modelo.");
      return;
    }
    setSavingTemplate(true);
    try {
      const formData = new FormData();
      Object.entries(templateForm).forEach(([key, value]) => formData.append(key, value));
      formData.append("file", templateFile);
      const response = await fetch("/api/modelos", { method: "POST", body: formData });
      const payload = (await response.json()) as {
        template?: ManualTemplate;
        error?: string;
      };
      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Não foi possível salvar o modelo.");
      }
      setManualTemplates((current) => [payload.template!, ...current]);
      setTemplateDialogOpen(false);
      setTemplateFile(null);
      setTemplateForm({
        title: "",
        description: "",
        department: "RI/RTDPJ",
        subject: "",
        recipient: "",
        salutation: "Prezado(a),",
        body: "",
        closing:
          "Sem outro assunto para o momento, renovamos votos de elevada estima e consideração.",
      });
      toast.success("Novo modelo adicionado à biblioteca.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar modelo.");
    } finally {
      setSavingTemplate(false);
    }
  }

  function updateDraft<K extends keyof DraftLetter>(
    field: K,
    value: DraftLetter[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft.subject.trim() || !draft.recipient.trim() || !draft.body.trim()) {
      toast.error("Preencha assunto, destinatário e conteúdo.");
      return;
    }
    setSaving(true);
    try {
      if (editingLetterId) {
        const response = await fetch(`/api/oficios/${editingLetterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, version: editingVersion }),
        });
        const payload = (await response.json()) as { letter?: Letter; error?: string };
        if (!response.ok || !payload.letter) {
          throw new Error(payload.error || "Não foi possível salvar as alterações.");
        }
        updateLetters((current) =>
          current.map((item) => (item.id === payload.letter!.id ? payload.letter! : item)),
        );
        if (previewLetter?.id === payload.letter.id) {
          setPreviewLetter(payload.letter);
        }
        setComposerOpen(false);
        setEditingLetterId(null);
        toast.success(`Ofício nº ${formatLetterNumber(payload.letter)} atualizado.`);
        return;
      }

      const response = await fetch("/api/oficios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { letter?: Letter; error?: string };
      if (!response.ok || !payload.letter) {
        throw new Error(payload.error || "Não foi possível salvar o ofício");
      }
      updateLetters((current) => [payload.letter!, ...current]);
      setComposerOpen(false);
      setActiveView("letters");
      toast.success(`Ofício nº ${formatLetterNumber(payload.letter)} salvo.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(letter: Letter, status: LetterStatus) {
    if ((status === "Enviado" || status === "Arquivado") && !letter.signedFileKey) {
      toast.error("Assine e anexe o PDF antes de concluir esta etapa.");
      return;
    }
    try {
      const response = await fetch(`/api/oficios/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, version: letter.version }),
      });
      const payload = (await response.json()) as { error?: string; letter: Letter };
      if (!response.ok) throw new Error(payload.error || "Não foi possível alterar o status.");
      updateLetters((current) => current.map((item) => item.id === letter.id ? payload.letter : item));
      toast.success(`Status alterado para ${status}.`);
    } catch (error) {
      setRefreshToken((value) => value + 1);
      toast.error(
        error instanceof Error ? error.message : "Não foi possível alterar o status.",
      );
    }
  }

  async function startSignature(
    letter: Letter,
    provider: SignatureProvider = "ONR",
  ) {
    const signerUrl =
      provider === "ONR"
        ? "https://assinador.onr.org.br/"
        : "https://acrobat.adobe.com/?x_api_client_id=acom_nav";

    // Abre a aba imediatamente no clique do usuário para evitar bloqueio de pop-up
    window.open(signerUrl, "_blank", "noopener,noreferrer");

    setSignatureProvider(provider);
    setSignedFile(null);
    setSignatureLetter(letter);

    try {
      await downloadOriginalPdf(letter);
      toast.success(
        `PDF gerado e baixado. Assine no ${provider} e anexe o arquivo resultante.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF para assinatura.",
      );
    }
  }

  function openAttachSignatureOnly(
    letter: Letter,
    provider: SignatureProvider = "ONR",
  ) {
    setSignatureProvider(provider);
    setSignedFile(null);
    setSignatureLetter(letter);
  }

  async function identifySignedFile(file: File | null) {
    setSignedFile(null);
    if (!file) return;
    if (file.size < 5 || file.size > 20 * 1024 * 1024) {
      toast.error("Selecione um PDF assinado de até 20 MB.");
      return;
    }
    const headerBytes = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
    const signature = new TextDecoder("latin1").decode(headerBytes);
    if (!signature.includes("%PDF-")) {
      toast.error("O arquivo selecionado não foi identificado como PDF válido.");
      return;
    }
    setSignedFile(file);
    toast.success(`PDF identificado: ${file.name}`);
  }

  async function sendDirectEmail() {
    if (!emailLetter) return;
    const recipient = emailMessage.recipient.trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Informe um endereço de e-mail válido para envio.");
      return;
    }
    if (!emailLetter.signedFileKey) {
      toast.error("O ofício precisa estar assinado para ser enviado.");
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch(`/api/oficios/${emailLetter.id}/enviar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: recipient,
          subject: emailMessage.subject.trim(),
          body: emailMessage.body.trim(),
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        letter?: Letter;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.letter) {
        throw new Error(payload.error || "Não foi possível enviar o e-mail.");
      }

      updateLetters((current) =>
        current.map((item) => (item.id === payload.letter!.id ? payload.letter! : item)),
      );
      setEmailLetter(null);
      toast.success(
        payload.message || `Ofício enviado com sucesso para ${recipient}!`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar e-mail.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function downloadOriginalPdf(letter: Letter) {
    const response = await fetch(
      `/api/oficios/${letter.id}/pdf?disposition=attachment`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error || "Não foi possível gerar o PDF do ofício.");
    }
    const blob = await response.blob();
    if (blob.type !== "application/pdf" || blob.size < 100) {
      throw new Error("O arquivo PDF gerado não é válido.");
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix = letter.suffix
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.download = `oficio-${String(letter.number).padStart(2, "0")}-${letter.year}${suffix ? `-${suffix}` : ""}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function printPreview() {
    if (!previewLetter) return;

    const pdfUrl = new URL(
      `/api/oficios/${previewLetter.id}/pdf`,
      window.location.origin,
    );
    pdfUrl.searchParams.set("disposition", "inline");
    pdfUrl.searchParams.set("print", String(Date.now()));

    const printWindow = window.open(pdfUrl.toString(), "_blank");
    if (!printWindow) {
      toast.error("Permita a abertura de janelas para imprimir o PDF do ofício.");
      return;
    }

    const openPrintDialog = () => {
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          // O visualizador de PDF permanece aberto para impressão manual.
        }
      }, 900);
    };

    printWindow.addEventListener("load", openPrintDialog, { once: true });
  }

  async function uploadSignedDocument() {
    if (!signatureLetter || !signedFile) {
      toast.error("Selecione o PDF assinado no Assinador ONR.");
      return;
    }

    setUploadingSigned(true);
    try {
      const formData = new FormData();
      formData.append("file", signedFile);
      formData.append("provider", signatureProvider);
      formData.append("version", String(signatureLetter.version));
      const response = await fetch(
        `/api/oficios/${signatureLetter.id}/signed-document`,
        { method: "POST", body: formData },
      );
      const payload = (await response.json()) as { letter?: Letter; error?: string };
      if (!response.ok || !payload.letter) {
        throw new Error(payload.error || "Não foi possível guardar o PDF assinado.");
      }

      updateLetters((current) =>
        current.map((item) =>
          item.id === payload.letter!.id ? payload.letter! : item,
        ),
      );
      setSignatureLetter(null);
      setSignedFile(null);
      toast.success(
        `PDF assinado pelo ${signatureProvider} anexado. Status alterado para Assinado.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao guardar o PDF assinado.",
      );
    } finally {
      setUploadingSigned(false);
    }
  }

  function downloadSignedDocument(letter: Letter) {
    const link = document.createElement("a");
    link.href = `/api/oficios/${letter.id}/signed-document`;
    link.download = letter.signedFileName || `oficio-${letter.number}-${letter.year}-assinado.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openEmailSend(letter: Letter) {
    const senderName = currentUser?.fullName?.trim() || letter.signerName;
    setEmailMessage({
      recipient: letter.recipientEmail || "",
      subject: `Ofício nº ${formatLetterNumber(letter)} — ${letter.subject}`,
      body: `Prezado(a),\n\nEncaminhamos, em apenso, o Ofício nº ${formatLetterNumber(letter)}, para conhecimento e providências cabíveis.\n\nAt, te.\n${senderName}`,
    });
    setEmailLetter(letter);
    setEmailPrepared(false);
  }

  function prepareEmailSend() {
    if (!emailLetter) return;
    const recipient = emailMessage.recipient.trim();
    if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Informe um endereço de e-mail válido ou deixe o campo em branco para preenchê-lo no Gmail.");
      return;
    }
    if (!emailLetter.signedFileKey) {
      toast.error("Anexe o PDF assinado antes de preparar o envio.");
      return;
    }

    const gmailUrl = new URL("https://mail.google.com/mail/u/0/");
    gmailUrl.searchParams.set("tab", "rm");
    gmailUrl.searchParams.set("ogbl", "");
    gmailUrl.searchParams.set("view", "cm");
    gmailUrl.searchParams.set("fs", "1");
    if (recipient) gmailUrl.searchParams.set("to", recipient);
    gmailUrl.searchParams.set("su", emailMessage.subject);
    gmailUrl.searchParams.set("body", emailMessage.body);

    const gmailWindow = window.open("about:blank", "_blank");
    downloadSignedDocument(emailLetter);
    if (!gmailWindow) {
      toast.error("O navegador bloqueou a nova guia. Permita pop-ups para abrir o Gmail.");
      return;
    }
    gmailWindow.opener = null;
    gmailWindow.location.href = gmailUrl.toString();
    setEmailPrepared(true);
    toast.success("Gmail aberto e PDF baixado. Anexe o arquivo antes de enviar.");
  }

  async function confirmEmailSent() {
    if (!emailLetter) return;
    try {
      const response = await fetch(`/api/oficios/${emailLetter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Enviado",
          sentByEmail: true,
          version: emailLetter.version,
          recipientEmail: emailMessage.recipient.trim(),
        }),
      });
      const payload = (await response.json()) as { letter?: Letter; error?: string };
      if (!response.ok || !payload.letter) {
        throw new Error(payload.error || "Não foi possível registrar o envio.");
      }
      updateLetters((current) =>
        current.map((letter) => (letter.id === payload.letter!.id ? payload.letter! : letter)),
      );
      setEmailLetter(null);
      setEmailPrepared(false);
      toast.success("Envio por e-mail registrado e contabilizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o envio.");
    }
  }

  async function copyLetter(letter: Letter) {
    const text = `OFÍCIO Nº ${formatLetterNumber(letter)}\n\nAssunto: ${
      letter.subject
    }${letter.reference ? `\nReferência: ${letter.reference}` : ""}\n\n${
      letter.recipient
    }\n${letter.recipientRole}\n\n${letter.salutation}\n\n${letter.body}\n\n${
      letter.closing
    }\n\nManacapuru - AM, ${formatLongDate(letter.issueDate)}.\n\n${
      letter.signerName
    }\n${letter.signerRole}`;
    await navigator.clipboard.writeText(text);
    toast.success("Texto do ofício copiado.");
  }

  const recentLetters = summary.recentLetters;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="border-b border-[#d8c9a3]/50 px-4 py-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <Image
              src="/apple-touch-icon.png"
              alt="2º Ofício"
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-lg shadow-sm object-cover"
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate font-serif text-base font-bold text-[#09090b]">
                Sistema de Ofícios
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                2º Ofício · Manacapuru
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Gestão documental
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.filter((item) => item.key !== "settings" || user.role === "admin").map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={activeView === item.key}
                      tooltip={item.label}
                      onClick={() => setActiveView(item.key)}
                      className="h-10 data-[active=true]:bg-[#e9e2cf] data-[active=true]:font-semibold data-[active=true]:text-[#09090b]"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-[#d8c9a3]/50 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/65 p-2 group-data-[collapsible=icon]:justify-center">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#09090b] text-xs font-bold text-white">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-semibold text-slate-800">
                {user.displayName}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {user.role === "admin" ? "Administrador" : "Operador"}
              </p>
            </div>
          </div>
          <LogoutButton />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="office-system-shell min-w-0 bg-[#09090b]">
        <div className="office-background-mark" aria-hidden="true" />
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#09090b]/95 px-4 text-white backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <div>
              <p className="text-xs font-medium text-[#c9b879]">
                {formatHeaderDate()}
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                {navItems.find((item) => item.key === activeView)?.label}
              </h1>
            </div>
          </div>
          <Button
            onClick={() => openComposer("livre")}
            className="bg-[#a68845] text-white shadow-sm hover:bg-[#8f7336]"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo ofício</span>
          </Button>
        </header>

        <div className="no-print relative z-10 mx-auto w-full max-w-[1500px] p-4 md:p-7">
          {activeView === "overview" && (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Próximo número"
                  value={String(nextNumber).padStart(2, "0") + `/${currentYear}`}
                  note="Sequência automática"
                  icon={Hash}
                  tone="gold"
                />
                <StatCard
                  label="Rascunhos"
                  value={String(counts.Rascunho)}
                  note="Aguardando conclusão"
                  icon={CircleDashed}
                />
                <StatCard
                  label="Em revisão"
                  value={String(counts["Em revisão"])}
                  note="Pendentes de conferência"
                  icon={ClipboardCheck}
                />
                <StatCard
                  label="Enviados"
                  value={String(counts.Enviado)}
                  note="Enviados por e-mail"
                  icon={Send}
                  tone="slate"
                  onClick={() => {
                    setStatusFilter("Enviado");
                    setPage(1);
                    setActiveView("letters");
                  }}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h2 className="font-semibold text-[#09090b]">Ofícios recentes</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Controle central de elaboração, assinatura e envio
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveView("letters")}
                      className="text-[#7f682f]"
                    >
                      Ver acervo <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <LettersTable
                    letters={recentLetters}
                    loading={loading}
                    onPreview={openLetterPreview}
                    onCopy={copyLetter}
                    onStatus={updateStatus}
                    onSign={startSignature}
                    onAttachOnly={openAttachSignatureOnly}
                    onDownloadSigned={downloadSignedDocument}
                    onEmail={openEmailSend}
                    onEdit={openEditLetter}
                    onWebPkiSign={openWebPkiSign}
                    emptyAction={() => openComposer("livre")}
                  />
                </div>

                <div className="rounded-2xl bg-[#09090b] border border-slate-800 p-5 text-white shadow-sm">
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d9c384]">
                        Modelos inteligentes
                      </p>
                      <h2 className="mt-1 font-serif text-xl font-bold">
                        Comece com o padrão certo
                      </h2>
                    </div>
                    <Sparkles className="size-5 text-[#d9c384]" />
                  </div>
                  <div
                    className="template-scroll scrollbar-thin max-h-[268px] space-y-2.5 overflow-y-auto pr-1"
                    role="region"
                    aria-label="Todos os modelos disponíveis"
                    tabIndex={0}
                  >
                    {templates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => openComposer(template.key)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/7 p-3 text-left transition hover:bg-white/12"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d9c384]/15 text-[#ead79d]">
                          <template.icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{template.title}</p>
                          <p className="truncate text-[11px] text-white/55">
                            {template.source}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white" />
                      </button>
                    ))}
                    {manualTemplates.map((template) => (
                      <button
                        key={`manual-overview-${template.id}`}
                        type="button"
                        onClick={() => openManualTemplate(template)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/7 p-3 text-left transition hover:bg-white/12"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d9c384]/15 text-[#ead79d]">
                          <UploadCloud className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{template.title}</p>
                          <p className="truncate text-[11px] text-white/55">
                            Adicionado manualmente · {template.sourceFileName}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white" />
                      </button>
                    ))}
                    {templatesLoading && (
                      <div className="flex items-center justify-center py-3 text-xs text-white/55">
                        <Loader2 className="mr-2 size-3.5 animate-spin" /> Carregando modelos...
                      </div>
                    )}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/45">
                    Role a lista para visualizar todas as opções
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView("templates")}
                    className="mt-3 text-xs font-semibold text-[#ead79d] hover:text-white"
                  >
                    Consultar biblioteca de modelos
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[#09090b]">Fluxo padronizado</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Cada documento mantém número, responsável, conteúdo e etapa
                    </p>
                  </div>
                  <ShieldCheck className="size-5 text-[#a68845]" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {statuses.map((status, index) => (
                    <div
                      key={status}
                      className="rounded-xl border border-slate-200 bg-[#fafaf8] p-3.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Etapa {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{status}</p>
                      <p className="mt-3 text-2xl font-semibold text-[#09090b]">
                        {counts[status]}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeView === "letters" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold text-[#09090b]">Acervo de ofícios</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pesquise por número, assunto, destinatário ou referência
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                      placeholder="Pesquisar ofícios"
                      className="w-full pl-9 sm:w-72"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos os status</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <LettersTable
                letters={filteredLetters}
                loading={loading}
                onPreview={openLetterPreview}
                onCopy={copyLetter}
                onStatus={updateStatus}
                onSign={startSignature}
                onAttachOnly={openAttachSignatureOnly}
                onDownloadSigned={downloadSignedDocument}
                onEmail={openEmailSend}
                onEdit={openEditLetter}
                onWebPkiSign={openWebPkiSign}
                emptyAction={() => openComposer("livre")}
              />
              <div className="flex items-center justify-between border-t p-4 text-sm text-slate-600"><span>{summary.total} ofícios · Página {page} de {Math.max(1, Math.ceil(summary.total / 50))}</span><div className="flex gap-2"><Button variant="outline" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" disabled={loading || page * 50 >= summary.total} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div>
            </section>
          )}

          {activeView === "templates" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <Badge
                  variant="outline"
                  className="mb-3 border-[#d6c38c] bg-[#f4eddb] text-[#725d2c]"
                >
                  Biblioteca institucional
                </Badge>
                <h2 className="font-serif text-3xl font-bold tracking-tight text-[#f6efd9]">
                  Modelos que preservam o padrão do cartório
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
                  Os campos variáveis ficam destacados para revisão, enquanto
                  cabeçalho, tratamento, fecho e rodapé permanecem uniformes.
                </p>
              </div>
                <Button
                  onClick={() => setTemplateDialogOpen(true)}
                  className="bg-[#09090b] text-white hover:bg-[#27272a]"
                >
                  <Upload className="size-4" /> Adicionar novo modelo
                </Button>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((template) => (
                  <article
                    key={template.key}
                    className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="grid size-11 place-items-center rounded-xl bg-[#eee6d2] text-[#886e31]">
                      <template.icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#09090b]">
                      {template.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {template.description}
                    </p>
                    <p className="mt-3 text-[11px] font-medium text-slate-400">
                      {template.source}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => openComposer(template.key)}
                      className="mt-auto border-[#cdbb89] text-[#6d592d] hover:bg-[#f4eddb]"
                    >
                      Usar este modelo <PenLine className="size-4" />
                    </Button>
                  </article>
                ))}
                {manualTemplates.map((template) => (
                  <article
                    key={`manual-${template.id}`}
                    className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-900">
                        <UploadCloud className="size-5" />
                      </div>
                      <Badge variant="outline" className="border-slate-200 text-slate-700">
                        Adicionado manualmente
                      </Badge>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#09090b]">
                      {template.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {template.description || "Modelo institucional enviado pela equipe."}
                    </p>
                    <p className="mt-3 truncate text-[11px] font-medium text-slate-400">
                      Arquivo: {template.sourceFileName}
                    </p>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <Button
                        variant="outline"
                        asChild
                        className="border-slate-200 text-slate-600"
                      >
                        <a
                          href={`/api/modelos/${template.id}/arquivo`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir arquivo <Eye className="size-4" />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openManualTemplate(template)}
                        className="border-[#cdbb89] text-[#6d592d] hover:bg-[#f4eddb]"
                      >
                        Usar modelo <PenLine className="size-4" />
                      </Button>
                    </div>
                  </article>
                ))}
                {templatesLoading && (
                  <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Carregando modelos...
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === "settings" && user.role === "admin" && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#eee6d2] text-[#886e31]">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#09090b]">Destinatários de e-mail</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Cadastre os endereços usados para o envio dos ofícios
                    </p>
                  </div>
                </div>
                <form onSubmit={saveEmailRecipient} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
                  <div>
                    <FieldLabel>Nome do destinatário</FieldLabel>
                    <Input
                      value={emailRecipientForm.name}
                      onChange={(event) => setEmailRecipientForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Nome da pessoa ou setor"
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Órgão ou instituição</FieldLabel>
                    <Input
                      value={emailRecipientForm.organization}
                      onChange={(event) => setEmailRecipientForm((current) => ({ ...current, organization: event.target.value }))}
                      placeholder="Ex.: 2ª Vara, Prefeitura"
                    />
                  </div>
                  <div>
                    <FieldLabel>E-mail</FieldLabel>
                    <Input
                      type="email"
                      value={emailRecipientForm.email}
                      onChange={(event) => setEmailRecipientForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="destinatario@instituicao.gov.br"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={savingEmailRecipient} className="bg-[#a68845] text-white hover:bg-[#8f7336]">
                    {savingEmailRecipient ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Cadastrar
                  </Button>
                </form>
                <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {emailRecipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fafaf8] p-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#09090b] text-white">
                        <Mail className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{recipient.name}</p>
                        {recipient.organization && <p className="truncate text-[11px] text-slate-500">{recipient.organization}</p>}
                        <p className="truncate text-xs text-slate-700">{recipient.email}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-slate-400 hover:text-red-600"
                        onClick={() => void deleteEmailRecipient(recipient)}
                        aria-label={`Excluir ${recipient.email}`}
                        title="Excluir e-mail"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {!emailRecipientsLoading && emailRecipients.length === 0 && (
                    <p className="text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                      Nenhum destinatário de e-mail cadastrado.
                    </p>
                  )}
                  {emailRecipientsLoading && (
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="size-4 animate-spin" /> Carregando e-mails...
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-[#09090b] text-white">
                      <Send className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#09090b]">Servidor de e-mail (envio direto)</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Configure a conta para disparo automático de ofícios com anexo do PDF assinado
                      </p>
                    </div>
                  </div>
                  {emailConfigForm.passConfigured && (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Senha configurada
                    </Badge>
                  )}
                </div>

                <form onSubmit={saveEmailConfigSubmit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <FieldLabel>Servidor SMTP (Host)</FieldLabel>
                    <Input
                      value={emailConfigForm.host}
                      onChange={(e) => setEmailConfigForm((cur) => ({ ...cur, host: e.target.value }))}
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </div>

                  <div>
                    <FieldLabel>Porta</FieldLabel>
                    <Input
                      type="number"
                      value={emailConfigForm.port}
                      onChange={(e) => setEmailConfigForm((cur) => ({ ...cur, port: Number(e.target.value) }))}
                      placeholder="465"
                      required
                    />
                  </div>

                  <div>
                    <FieldLabel>Conexão segura (SSL/TLS)</FieldLabel>
                    <Select
                      value={emailConfigForm.secure ? "true" : "false"}
                      onValueChange={(val) => setEmailConfigForm((cur) => ({ ...cur, secure: val === "true" }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim (porta 465 SSL/TLS direta)</SelectItem>
                        <SelectItem value="false">STARTTLS (porta 587)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel>Usuário / E-mail de envio</FieldLabel>
                    <Input
                      type="email"
                      value={emailConfigForm.user}
                      onChange={(e) => setEmailConfigForm((cur) => ({ ...cur, user: e.target.value }))}
                      placeholder="ri.tdpj2oficio@gmail.com"
                      required
                    />
                  </div>

                  <div>
                    <FieldLabel>
                      {emailConfigForm.passConfigured ? "Alterar senha de app" : "Senha de aplicativo"}
                    </FieldLabel>
                    <Input
                      type="password"
                      value={emailConfigForm.pass}
                      onChange={(e) => setEmailConfigForm((cur) => ({ ...cur, pass: e.target.value }))}
                      placeholder={emailConfigForm.passConfigured ? "•••••••••••••••• (inalterada)" : "Senha de 16 caracteres"}
                    />
                  </div>

                  <div>
                    <FieldLabel>Nome do remetente</FieldLabel>
                    <Input
                      value={emailConfigForm.fromName}
                      onChange={(e) => setEmailConfigForm((cur) => ({ ...cur, fromName: e.target.value }))}
                      placeholder="2º Ofício de Manacapuru/AM"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 leading-5">
                      <strong>Dica para contas Gmail:</strong> Caso utilize o Gmail, ative a Verificação em 2 etapas na conta Google e crie uma <em>&quot;Senha de app&quot;</em> em <u>Gerenciar Conta Google &gt; Segurança &gt; Senhas de app</u>. Use essa senha gerada de 16 caracteres no campo acima.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-100">
                    <Button
                      type="submit"
                      disabled={savingEmailConfig || loadingEmailConfig}
                      className="bg-[#09090b] text-white hover:bg-[#27272a]"
                    >
                      {savingEmailConfig ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Salvando configurações...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" /> Salvar configurações de e-mail
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
                      <Input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="E-mail para receber teste"
                        className="w-full sm:w-64"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={testingEmail || !testEmailAddress.trim()}
                        onClick={testEmailSubmit}
                      >
                        {testingEmail ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Testando...
                          </>
                        ) : (
                          "Testar envio"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#09090b]">Assinatura Digital Direta (Web PKI)</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Integração para assinatura direta com Token USB A3 ou Certificado A1 na máquina
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs font-normal text-emerald-800">
                    {pkiConfig.certificateValidationConfigured ? "Configuração disponível" : "Validação pendente"}
                  </Badge>
                </div>

                <form onSubmit={savePkiConfigSubmit} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Chave de Licença Web PKI (Lacuna)</FieldLabel>
                      <Input
                        value={pkiConfig.licenseKey}
                        onChange={(e) => setPkiConfig((cur) => ({ ...cur, licenseKey: e.target.value }))}
                        placeholder="Em branco para localhost ou cole a licença do domínio"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Em desenvolvimento local (localhost), a licença integrada é usada automaticamente.
                      </p>
                    </div>

                    <div>
                      <FieldLabel>Token Rest PKI (Opcional)</FieldLabel>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={pkiConfig.restPkiToken}
                        onChange={(e) => setPkiConfig((cur) => ({ ...cur, restPkiToken: e.target.value }))}
                        placeholder={pkiConfig.restPkiTokenConfigured ? "Configurado. Preencha apenas para substituir." : "Opcional: chave de API da nuvem Lacuna"}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Caso utilize serviços gerenciados de carimbo do tempo ou HSM em nuvem.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-[#fafaf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                      <span>
                        Extensão compatível com Chrome, Edge, Firefox, Brave e leitoras de cartão/tokens ePass2003, SafeNet e GD Starsign.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open("https://get.webpkiplugin.com/", "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Download className="size-3.5" /> Baixar Extensão Web PKI
                        <ExternalLink className="ml-1 size-3 opacity-60" />
                      </Button>
                      <Button
                        type="submit"
                        disabled={savingPkiConfig || loadingPkiConfig}
                        className="bg-[#a68845] text-white hover:bg-[#8f7336]"
                        size="sm"
                      >
                        {savingPkiConfig ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Salvar configurações
                      </Button>
                    </div>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#eee6d2] text-[#886e31]">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#09090b]">Identidade institucional</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Dados aplicados automaticamente aos documentos
                    </p>
                  </div>
                </div>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Info label="Serventia" value="2º Ofício de Manacapuru/AM" />
                  <Info label="Oficial Registrador" value="Paulo Henrique Felberk de Almeida" />
                  <Info label="Endereço" value="Av. Ribeiro Júnior, nº 373, Centro, Manacapuru/AM" />
                  <Info label="CEP padronizado" value="69.400-366" />
                  <Info label="E-mail RI/RTDPJ" value="ri.tdpj2oficio@gmail.com" />
                  <Info label="E-mail RCPN" value="rcpn2oficio@gmail.com" />
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-900">
                    <UserRoundCheck className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#09090b]">Assinantes cadastrados</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Nome e função inseridos no fecho</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {signers.map((signer) => (
                    <div
                      key={signer.name}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fafaf8] p-3"
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#09090b] text-[10px] font-bold text-white">
                        {signer.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{signer.name}</p>
                        <p className="text-[11px] text-slate-500">{signer.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <AccessSettings />
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 xl:col-span-2">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-900">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Assinatura digital pelo Assinador ONR
                      </h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                        O certificado A3 é utilizado no ambiente da ONR. O sistema só
                        registra o ofício como assinado depois que o PDF resultante é
                        anexado novamente ao acervo.
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="w-fit border-slate-300 bg-white text-slate-800 hover:bg-slate-100">
                    <a href="https://assinador.onr.org.br/" target="_blank" rel="noreferrer">
                      Abrir Assinador ONR <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-[#d6c38c] bg-[#f4eddb] p-5 xl:col-span-2">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 text-[#82692f]" />
                    <div>
                      <h3 className="font-semibold text-[#59491f]">Regras de padronização ativas</h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#725f32]">
                        Numeração anual sequencial, data por extenso, identificação da
                        unidade responsável, modelos por finalidade, histórico de
                        status, assinatura ONR vinculada ao PDF e cabeçalho
                        institucional único.
                      </p>
                    </div>
                  </div>
                  <Badge className="w-fit bg-[#82692f] text-white">Exercício {currentYear}</Badge>
                </div>
              </section>
            </div>
          )}
        </div>
      </SidebarInset>

      <Dialog
        modal={composerMode !== "minimized"}
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) {
            setComposerMode("normal");
            setEditingLetterId(null);
          }
        }}
      >
        <DialogContent
          className={`no-print flex overflow-hidden p-0 ${
            composerMode === "maximized"
              ? "composer-maximized"
              : composerMode === "minimized"
                ? "composer-minimized"
                : "composer-resizable"
          }`}
        >
          <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 pr-12">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 truncate text-[#09090b]">
                <FilePenLine className="size-5 shrink-0 text-[#a68845]" />
                {editingLetterId ? `Editar ofício nº ${formatLetterNumber(draft)}` : "Elaborar novo ofício"}
              </DialogTitle>
              {composerMode !== "minimized" && (
                <DialogDescription>
                  {editingLetterId
                    ? "Altere os dados do rascunho. O número e o ano são mantidos para preservar o sequencial oficial."
                    : "Preencha os campos e confira a versão padronizada ao lado."}
                  {composerMode === "normal" && (
                    <span className="ml-1 hidden lg:inline">
                      Arraste o canto inferior direito para ajustar o tamanho.
                    </span>
                  )}
                </DialogDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {composerMode === "minimized" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setComposerMode("normal")}
                  title="Restaurar janela"
                  aria-label="Restaurar janela"
                >
                  <Maximize2 className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setComposerMode("minimized")}
                  title="Minimizar janela"
                  aria-label="Minimizar janela"
                >
                  <Minimize2 className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setComposerMode((current) =>
                    current === "maximized" ? "normal" : "maximized",
                  )
                }
                title={composerMode === "maximized" ? "Restaurar tamanho" : "Maximizar janela"}
                aria-label={composerMode === "maximized" ? "Restaurar tamanho" : "Maximizar janela"}
              >
                {composerMode === "maximized" ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </div>
          </DialogHeader>

          {composerMode !== "minimized" && (
          <form
            onSubmit={saveDraft}
            className="grid min-h-0 flex-1 lg:grid-cols-[minmax(420px,.9fr)_minmax(500px,1.1fr)]"
          >
            <div className="min-h-0 overflow-y-auto bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>
                    Número {editingLetterId && <span className="text-[10px] font-normal text-slate-400">(inalterável)</span>}
                  </FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={draft.number}
                    onChange={(event) => updateDraft("number", Number(event.target.value))}
                    disabled={Boolean(editingLetterId)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>
                    Ano {editingLetterId && <span className="text-[10px] font-normal text-slate-400">(inalterável)</span>}
                  </FieldLabel>
                  <Input
                    type="number"
                    value={draft.year}
                    onChange={(event) => updateDraft("year", Number(event.target.value))}
                    disabled={Boolean(editingLetterId)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>
                    Sufixo {editingLetterId && <span className="text-[10px] font-normal text-slate-400">(inalterável)</span>}
                  </FieldLabel>
                  <Input
                    value={draft.suffix}
                    onChange={(event) => updateDraft("suffix", event.target.value)}
                    placeholder="Ex.: MPU"
                    disabled={Boolean(editingLetterId)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Data do ofício</FieldLabel>
                  <Input
                    type="date"
                    value={draft.issueDate}
                    onChange={(event) => updateDraft("issueDate", event.target.value)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Setor</FieldLabel>
                  <Select value={draft.department} onValueChange={(value) => updateDraft("department", value)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RI/RTDPJ">RI/RTDPJ</SelectItem>
                      <SelectItem value="RCPN">RCPN</SelectItem>
                      <SelectItem value="RCPJ">RCPJ</SelectItem>
                      <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="my-5 border-t border-slate-100" />
              <div className="space-y-4">
                <div>
                  <FieldLabel>Assunto</FieldLabel>
                  <Input value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} placeholder="Objeto principal do ofício" required />
                </div>
                <div>
                  <FieldLabel>Referência</FieldLabel>
                  <Input value={draft.reference} onChange={(event) => updateDraft("reference", event.target.value)} placeholder="Processo, protocolo, matrícula ou expediente" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <FieldLabel>Destinatário</FieldLabel>
                    {emailRecipients.length > 0 && (
                      <span className="text-[11px] text-slate-500">
                        {emailRecipients.length} cadastrado(s)
                      </span>
                    )}
                  </div>
                  {emailRecipients.length > 0 && (
                    <div className="mb-2">
                      <Select
                        value={
                          emailRecipients.some(
                            (item) =>
                              item.email === draft.recipientEmail ||
                              item.name.toLowerCase() === draft.recipient.toLowerCase().trim(),
                          )
                            ? emailRecipients.find(
                                (item) =>
                                  item.email === draft.recipientEmail ||
                                  item.name.toLowerCase() === draft.recipient.toLowerCase().trim(),
                              )?.email
                            : undefined
                        }
                        onValueChange={(email) => {
                          const saved = emailRecipients.find((item) => item.email === email);
                          if (saved) {
                            updateDraft("recipient", saved.name);
                            if (saved.organization) {
                              updateDraft("recipientRole", saved.organization);
                            }
                            updateDraft("recipientEmail", saved.email);
                            toast.info(`Destinatário "${saved.name}" carregado.`);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-slate-50/80 border-slate-200">
                          <SelectValue placeholder="Preencher com destinatário cadastrado..." />
                        </SelectTrigger>
                        <SelectContent>
                          {emailRecipients.map((recipient) => (
                            <SelectItem key={recipient.id} value={recipient.email}>
                              {recipient.name}
                              {recipient.organization ? ` (${recipient.organization})` : ""} — {recipient.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Input
                    value={draft.recipient}
                    onChange={(event) => updateDraft("recipient", event.target.value)}
                    placeholder="Nome da autoridade ou órgão destinatário"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <FieldLabel>E-mail para envio</FieldLabel>
                    {draft.recipient.trim() &&
                      draft.recipientEmail.trim() &&
                      !emailRecipients.some(
                        (item) => item.email.toLowerCase() === draft.recipientEmail.trim().toLowerCase(),
                      ) && (
                        <button
                          type="button"
                          onClick={() => void saveDraftRecipient()}
                          disabled={savingDraftRecipient}
                          className="text-[11px] font-medium text-[#09090b] hover:text-[#27272a] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {savingDraftRecipient ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Plus className="size-3" />
                          )}
                          Salvar nos cadastrados
                        </button>
                      )}
                  </div>
                  <Input
                    type="email"
                    value={draft.recipientEmail}
                    onChange={(event) => updateDraft("recipientEmail", event.target.value)}
                    placeholder="destinatario@instituicao.gov.br"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Opcional no rascunho; obrigatório para envio por e-mail após a assinatura.
                  </p>
                </div>
                <div>
                  <FieldLabel>Cargo ou complemento do destinatário</FieldLabel>
                  <Textarea
                    rows={2}
                    value={draft.recipientRole}
                    onChange={(event) => updateDraft("recipientRole", event.target.value)}
                    placeholder="Cargo, unidade e detalhes da autoridade destinatária"
                  />
                </div>
                <div>
                  <FieldLabel>Vocativo</FieldLabel>
                  <Input value={draft.salutation} onChange={(event) => updateDraft("salutation", event.target.value)} />
                </div>
                <div>
                  <FieldLabel>Conteúdo</FieldLabel>
                  <Textarea rows={10} value={draft.body} onChange={(event) => updateDraft("body", event.target.value)} placeholder="Redija o conteúdo do ofício" required className="leading-6" />
                  <p className="mt-1.5 text-[11px] text-slate-400">Revise os campos entre colchetes antes de concluir.</p>
                </div>
                <div>
                  <FieldLabel>Fecho</FieldLabel>
                  <Textarea rows={3} value={draft.closing} onChange={(event) => updateDraft("closing", event.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Assinante</FieldLabel>
                    <Select
                      value={draft.signerName}
                      onValueChange={(name) => {
                        const signer = signers.find((item) => item.name === name);
                        updateDraft("signerName", name);
                        if (signer) updateDraft("signerRole", signer.role);
                      }}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {signers.map((signer) => (
                          <SelectItem key={signer.name} value={signer.name}>{signer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Status inicial</FieldLabel>
                    <Select value={draft.status} onValueChange={(value) => updateDraft("status", value as LetterStatus)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {initialStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-l border-slate-200 bg-[#e7e5df] p-4 lg:p-7">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pré-visualização A4</p>
                <Badge variant="secondary" className="bg-white text-slate-600">Atualização automática</Badge>
              </div>
              <LetterPreview letter={draft} />
            </div>

            <DialogFooter className="col-span-full border-t border-slate-200 bg-white px-6 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setComposerOpen(false);
                  setEditingLetterId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#a68845] text-white hover:bg-[#8f7336]">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {editingLetterId ? "Salvar alterações" : "Salvar ofício"}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewLetter)} onOpenChange={(open) => !open && closeLetterPreview()}>
        <DialogContent
          ref={previewDialogRef}
          className={`print-dialog flex flex-col gap-3 overflow-hidden bg-[#e7e5df] p-4 sm:p-5 ${
            previewMode === "maximized"
              ? "preview-maximized rounded-xl"
              : "h-[94vh] w-[min(1180px,96vw)] max-w-none sm:max-w-none"
          }`}
          style={
            previewMode === "maximized"
              ? {
                  position: "fixed",
                  top: "12px",
                  left: "12px",
                  right: "12px",
                  bottom: "12px",
                  width: "calc(100vw - 24px)",
                  height: "calc(100vh - 24px)",
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: "none",
                  translate: "none",
                  margin: 0,
                  zIndex: 50,
                }
              : {
                  left: previewPosition ? `${previewPosition.left}px` : "50%",
                  top: previewPosition ? `${previewPosition.top}px` : "50%",
                }
          }
        >
          <DialogHeader
            className="no-print preview-drag-handle flex flex-row items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 pr-10 shrink-0 w-full"
            onPointerDown={startPreviewDrag}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="truncate text-base text-[#09090b]">
                  Ofício nº {previewLetter ? formatLetterNumber(previewLetter) : ""}
                </DialogTitle>
                {previewLetter?.status && (
                  <Badge className={`text-xs ${statusClasses(previewLetter.status)}`}>
                    {previewLetter.status}
                  </Badge>
                )}
              </div>
              <DialogDescription className="truncate">
                {previewLetter?.signedFileKey && previewTab === "pdf"
                  ? "Visualização do documento com assinatura digital"
                  : "Visualização padronizada do documento"}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {previewLetter?.signedFileKey && (
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("pdf")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      previewTab === "pdf"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    PDF Assinado
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("text")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      previewTab === "text"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Texto do Ofício
                  </button>
                </div>
              )}

              {previewLetter?.signedFileKey ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadSignedDocument(previewLetter)}
                    title="Baixar PDF assinado para o computador"
                  >
                    <Download className="size-4" /> Baixar PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (previewLetter) openWebPkiSign(previewLetter);
                    }}
                    title="Assinar novamente com certificado digital"
                  >
                    <KeyRound className="size-4" /> Assinar novamente
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#09090b] text-white hover:bg-[#27272a]"
                    onClick={() => {
                      const letter = previewLetter;
                      closeLetterPreview();
                      if (letter) openEmailSend(letter);
                    }}
                  >
                    <Mail className="size-4" /> Enviar por e-mail
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="bg-[#09090b] text-white hover:bg-[#27272a]"
                    onClick={() => {
                      if (previewLetter) openWebPkiSign(previewLetter);
                    }}
                    title="Assinar com Token A3 ou Certificado A1 diretamente na página"
                  >
                    <KeyRound className="size-4" /> Assinar direto na web
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" title="Outros métodos de assinatura">
                        Outras opções
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const letter = previewLetter;
                          closeLetterPreview();
                          if (letter) void startSignature(letter, "ONR");
                        }}
                      >
                        <KeyRound className="size-4" /> Assinador ONR (externo)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const letter = previewLetter;
                          closeLetterPreview();
                          if (letter) void startSignature(letter, "Adobe Acrobat");
                        }}
                      >
                        <FilePenLine className="size-4" /> Adobe Acrobat (externo)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const letter = previewLetter;
                          closeLetterPreview();
                          if (letter) openAttachSignatureOnly(letter, "ONR");
                        }}
                      >
                        <Upload className="size-4" /> Já assinei, anexar PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {previewLetter &&
                (previewLetter.status === "Rascunho" || previewLetter.status === "Em revisão") &&
                !previewLetter.signedFileKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const letterToEdit = previewLetter;
                      closeLetterPreview();
                      openEditLetter(letterToEdit);
                    }}
                    title="Editar conteúdo do rascunho"
                  >
                    <FilePenLine className="size-4" /> Editar rascunho
                  </Button>
                )}

              <Button
                variant="outline"
                size="sm"
                onClick={printPreview}
              >
                <Printer className="size-4" /> Imprimir / PDF
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setPreviewMode((current) => {
                    const next = current === "maximized" ? "normal" : "maximized";
                    if (next === "maximized") setPreviewPosition(null);
                    return next;
                  });
                }}
                title={previewMode === "maximized" ? "Restaurar tamanho" : "Maximizar tela cheia"}
                aria-label={previewMode === "maximized" ? "Restaurar tamanho" : "Maximizar tela cheia"}
              >
                {previewMode === "maximized" ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </div>
          </DialogHeader>

          {previewLetter && (
            <div className="print-document flex min-h-0 flex-1 flex-col overflow-hidden rounded-md w-full h-full">
              {previewLetter.signedFileKey && previewTab === "pdf" ? (
                <div className="flex h-full min-h-[420px] w-full flex-1 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                  <iframe
                    src={`/api/oficios/${previewLetter.id}/signed-document?disposition=inline`}
                    className="h-full w-full flex-1 border-0"
                    title={`PDF Assinado do Ofício ${formatLetterNumber(previewLetter)}`}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <LetterPreview letter={previewLetter} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <form onSubmit={saveManualTemplate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#09090b]">
                <UploadCloud className="size-5 text-[#a68845]" />
                Adicionar novo modelo
              </DialogTitle>
              <DialogDescription>
                Envie o arquivo de referência e, se desejar, preencha os campos que serão inseridos ao usar o modelo.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Arquivo de referência *</FieldLabel>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 hover:border-[#a68845] hover:bg-[#faf7ef]">
                  <UploadCloud className="size-5 shrink-0 text-[#8a7135]" />
                  <span className="min-w-0 truncate">
                    {templateFile ? templateFile.name : "Selecionar arquivo PDF ou DOCX (até 20 MB)"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                    className="sr-only"
                    onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Nome do modelo *</FieldLabel>
                <Input
                  value={templateForm.title}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex.: Resposta à solicitação judicial"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Descrição</FieldLabel>
                <Input
                  value={templateForm.description}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Quando este modelo deve ser utilizado"
                />
              </div>
              <div>
                <FieldLabel>Setor</FieldLabel>
                <Select
                  value={templateForm.department}
                  onValueChange={(value) =>
                    setTemplateForm((current) => ({ ...current, department: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RI/RTDPJ">RI/RTDPJ</SelectItem>
                    <SelectItem value="RCPN">RCPN</SelectItem>
                    <SelectItem value="RCPJ">RCPJ</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Tratamento</FieldLabel>
                <Input
                  value={templateForm.salutation}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, salutation: event.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Assunto padrão</FieldLabel>
                <Input
                  value={templateForm.subject}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder="Use [COLCHETES] para campos variáveis"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Destinatário padrão</FieldLabel>
                <Input
                  value={templateForm.recipient}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, recipient: event.target.value }))
                  }
                  placeholder="Ex.: À [ÓRGÃO DESTINATÁRIO]"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Texto-base</FieldLabel>
                <Textarea
                  value={templateForm.body}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, body: event.target.value }))
                  }
                  rows={6}
                  placeholder="Texto editável do modelo"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Fecho padrão</FieldLabel>
                <Textarea
                  value={templateForm.closing}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, closing: event.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setTemplateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingTemplate || !templateFile || !templateForm.title.trim()}
                className="bg-[#a68845] text-white hover:bg-[#8f7336]"
              >
                {savingTemplate ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Salvar modelo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(signatureLetter)}
        onOpenChange={(open) => {
          if (!open) {
            setSignatureLetter(null);
            setSignedFile(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#09090b]">
              <KeyRound className="size-5 text-slate-900" />
              Assinar com {signatureProvider === "ONR" ? "o Assinador ONR" : "Adobe Acrobat"}
            </DialogTitle>
            <DialogDescription>
              {signatureLetter
                ? `Ofício nº ${formatLetterNumber(signatureLetter)} · ${signatureLetter.signerName}`
                : "Fluxo de assinatura digital"}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            {signatureProvider === "ONR"
              ? "O token A3 é acessado pelo ambiente da ONR, não por este navegador."
              : "A assinatura é realizada no ambiente do Adobe Acrobat, não por este navegador."}{" "}
            Depois da assinatura, selecione ou arraste abaixo o PDF devolvido.
          </div>

          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eee6d2] text-xs font-bold text-[#725d2c]">
                1
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  PDF do ofício gerado
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  O arquivo foi baixado automaticamente ao iniciar este fluxo.
                  Se necessário, faça o download novamente.
                </p>
                {signatureLetter && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      void downloadOriginalPdf(signatureLetter).catch((error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível gerar o PDF do ofício.",
                        ),
                      );
                    }}
                  >
                    <Download className="size-4" /> Baixar PDF novamente
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-900">
                2
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  Envie o PDF e conclua a assinatura
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {signatureProvider === "ONR"
                    ? "No portal da ONR, envie o PDF, selecione o certificado A3 e conclua a assinatura com carimbo do tempo."
                    : "No Adobe Acrobat, envie o PDF e conclua a assinatura digital disponível na sua conta."}
                </p>
                <Button asChild size="sm" className="mt-3 bg-[#09090b] text-white hover:bg-[#27272a]">
                  <a
                    href={signatureProvider === "ONR" ? "https://assinador.onr.org.br/" : "https://acrobat.adobe.com/?x_api_client_id=acom_nav"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir novamente {signatureProvider === "ONR" ? "o Assinador ONR" : "o Adobe Acrobat"} <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                3
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  Anexe o PDF assinado
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Somente depois deste envio o sistema registrará o status
                  “Assinado”. Limite: 20 MB.
                </p>
                <label
                  className={`mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors ${signedFile ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-50 text-slate-600 hover:border-[#a68845] hover:bg-[#faf7ef]"}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void identifySignedFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  {signedFile ? (
                    <FileCheck2 className="size-5 shrink-0 text-emerald-700" />
                  ) : (
                    <UploadCloud className="size-5 shrink-0 text-[#8a7135]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {signedFile ? signedFile.name : "Selecionar ou arrastar o PDF assinado"}
                    </span>
                    {signedFile && (
                      <span className="mt-0.5 block text-xs text-emerald-700">
                        PDF identificado · {(signedFile.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => {
                      void identifySignedFile(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="mt-2 text-[11px] leading-4 text-slate-500">
                  Por segurança, o navegador não acessa automaticamente a pasta de downloads.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSignatureLetter(null);
                setSignedFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={uploadSignedDocument}
              disabled={!signedFile || uploadingSigned}
              className="bg-[#a68845] text-white hover:bg-[#8f7336]"
            >
              {uploadingSigned ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileCheck2 className="size-4" />
              )}
              Confirmar PDF assinado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(emailLetter)} onOpenChange={(open) => !open && !sendingEmail && setEmailLetter(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#09090b]">
              <Mail className="size-5 text-slate-900" /> Enviar ofício por e-mail
            </DialogTitle>
            <DialogDescription>
              {emailLetter
                ? `Ofício nº ${formatLetterNumber(emailLetter)} · Envio oficial com anexo do PDF assinado`
                : "Envio de comunicação oficial"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {emailRecipients.length > 0 && (
              <div>
                <FieldLabel>Destinatários frequentes</FieldLabel>
                <Select
                  value={emailRecipients.some((item) => item.email === emailMessage.recipient) ? emailMessage.recipient : undefined}
                  onValueChange={(recipient) => setEmailMessage((current) => ({ ...current, recipient }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar e-mail cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailRecipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.email}>
                        {recipient.name} {recipient.organization ? `(${recipient.organization})` : ""} — {recipient.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <FieldLabel>E-mail de destino *</FieldLabel>
              <Input
                type="email"
                value={emailMessage.recipient}
                onChange={(event) => setEmailMessage((current) => ({ ...current, recipient: event.target.value }))}
                placeholder="destinatario@instituicao.gov.br"
                required
              />
            </div>
            <div>
              <FieldLabel>Assunto da mensagem *</FieldLabel>
              <Input
                value={emailMessage.subject}
                onChange={(event) => setEmailMessage((current) => ({ ...current, subject: event.target.value }))}
                required
              />
            </div>
            <div>
              <FieldLabel>Mensagem</FieldLabel>
              <Textarea
                rows={6}
                value={emailMessage.body}
                onChange={(event) => setEmailMessage((current) => ({ ...current, body: event.target.value }))}
                className="leading-6"
              />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
              <span className="font-semibold text-emerald-950">Anexo oficial:</span> O documento assinado{" "}
              <strong>{emailLetter?.signedFileName || "oficio-assinado.pdf"}</strong> será anexado automaticamente na remessa direta pelo sistema.
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:space-x-2">
            <Button variant="ghost" disabled={sendingEmail} onClick={() => setEmailLetter(null)}>
              Cancelar
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={sendingEmail}
                onClick={prepareEmailSend}
                title="Abrir a tela de composição do Gmail e baixar o arquivo"
              >
                Abrir no Gmail (manual)
              </Button>
              {emailPrepared && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sendingEmail}
                  onClick={confirmEmailSent}
                  className="bg-slate-200 text-slate-800 hover:bg-slate-300"
                >
                  <CheckCircle2 className="size-4" /> Marcar como enviado no Gmail
                </Button>
              )}
              <Button
                type="button"
                onClick={sendDirectEmail}
                disabled={sendingEmail || !emailMessage.recipient.trim()}
                className="bg-[#09090b] text-white hover:bg-[#27272a]"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Enviando pelo sistema...
                  </>
                ) : (
                  <>
                    <Send className="size-4" /> Enviar agora pelo sistema
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {webPkiOpen && webPkiLetter && <WebPkiDialog
        key={webPkiLetter.id}
        open={webPkiOpen}
        onOpenChange={setWebPkiOpen}
        letter={webPkiLetter}
        onSuccess={handleWebPkiSuccess}
      />}
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "slate",
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Hash;
  tone?: "slate" | "gold" | "green";
  onClick?: () => void;
}) {
  const iconTone = {
    slate: "bg-slate-100 text-slate-600",
    gold: "bg-[#eee6d2] text-[#886e31]",
    green: "bg-slate-100 text-slate-900",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#09090b]">{value}</p>
        </div>
        <div className={`grid size-9 place-items-center rounded-xl ${iconTone}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{note}</p>
    </button>
  );
}

function LettersTable({
  letters,
  loading,
  onPreview,
  onCopy,
  onStatus,
  onSign,
  onAttachOnly,
  onDownloadSigned,
  onEmail,
  onEdit,
  onWebPkiSign,
  emptyAction,
}: {
  letters: Letter[];
  loading: boolean;
  onPreview: (letter: Letter, initialTab?: "pdf" | "text") => void;
  onCopy: (letter: Letter) => void;
  onStatus: (letter: Letter, status: LetterStatus) => void;
  onSign: (letter: Letter, provider?: SignatureProvider) => void;
  onAttachOnly?: (letter: Letter, provider?: SignatureProvider) => void;
  onDownloadSigned: (letter: Letter) => void;
  onEmail: (letter: Letter) => void;
  onEdit?: (letter: Letter) => void;
  onWebPkiSign?: (letter: Letter) => void;
  emptyAction: () => void;
}) {
  if (loading) {
    return (
      <div className="grid min-h-52 place-items-center text-sm text-slate-500">
        <div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando acervo...</div>
      </div>
    );
  }
  if (!letters.length) {
    return (
      <div className="grid min-h-60 place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eee6d2] text-[#886e31]"><Inbox className="size-5" /></div>
          <p className="mt-3 text-sm font-semibold text-slate-800">Nenhum ofício cadastrado</p>
          <p className="mt-1 text-xs text-slate-500">Inicie a sequência de {new Date().getFullYear()} usando um modelo padronizado.</p>
          <Button size="sm" onClick={emptyAction} className="mt-4 bg-[#a68845] text-white hover:bg-[#8f7336]"><Plus className="size-4" /> Criar primeiro ofício</Button>
        </div>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#fafaf8] hover:bg-[#fafaf8]">
          <TableHead className="pl-5">Número</TableHead>
          <TableHead>Assunto e destinatário</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12 pr-4 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {letters.map((letter) => (
          <TableRow key={letter.id}>
            <TableCell className="pl-5 font-mono text-xs font-semibold text-[#6d592d]">{formatLetterNumber(letter)}</TableCell>
            <TableCell className="max-w-[390px] whitespace-normal py-3">
              <button
                type="button"
                onClick={() => onPreview(letter, letter.signedFileKey ? "pdf" : "text")}
                className="block text-left"
              >
                <p className="line-clamp-1 text-sm font-medium text-slate-800 hover:text-[#8a7135]">{letter.subject}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{letter.recipient}</p>
                {letter.signedFileKey && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <FileCheck2 className="size-3" /> PDF assinado anexado
                  </span>
                )}
              </button>
            </TableCell>
            <TableCell><Badge variant="outline" className="font-normal text-slate-600">{letter.department}</Badge></TableCell>
            <TableCell className="text-xs text-slate-500">
              {letter.sentAt ? (
                <span className="font-medium text-emerald-700">
                  Enviado em {formatSentDate(letter.sentAt)}
                </span>
              ) : (
                formatShortDate(letter.issueDate)
              )}
            </TableCell>
            <TableCell>
              <Select value={letter.status} onValueChange={(value) => onStatus(letter, value as LetterStatus)}>
                <SelectTrigger size="sm" className={`h-7 min-w-28 border text-xs shadow-none ${statusClasses(letter.status)}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {letter.status === "Assinado" && (
                    <SelectItem value="Assinado" disabled>
                      {letter.signatureProvider
                        ? `Assinado via ${letter.signatureProvider}`
                        : "Assinado"}
                    </SelectItem>
                  )}
                  {editableStatuses.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      disabled={
                        (status === "Enviado" || status === "Arquivado") &&
                        !letter.signedFileKey
                      }
                    >
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="pr-4 text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /><span className="sr-only">Abrir ações</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {letter.signedFileKey ? (
                    <>
                      <DropdownMenuItem onClick={() => onPreview(letter, "pdf")}>
                        <Eye className="size-4" /> Visualizar PDF assinado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownloadSigned(letter)}>
                        <Download className="size-4" /> Baixar PDF assinado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEmail(letter)}>
                        <Mail className="size-4" /> Enviar por e-mail
                      </DropdownMenuItem>
                      {onWebPkiSign && (
                        <DropdownMenuItem onClick={() => onWebPkiSign(letter)}>
                          <KeyRound className="size-4 text-slate-700" /> Assinar novamente
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onCopy(letter)}>
                        <Copy className="size-4" /> Copiar texto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPreview(letter, "text")}>
                        <Printer className="size-4" /> Imprimir / PDF original
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => onPreview(letter, "text")}>
                        <Eye className="size-4" /> Visualizar ofício
                      </DropdownMenuItem>
                      {onEdit && (letter.status === "Rascunho" || letter.status === "Em revisão") && (
                        <DropdownMenuItem onClick={() => onEdit(letter)}>
                          <FilePenLine className="size-4" /> Editar rascunho
                        </DropdownMenuItem>
                      )}
                      {onWebPkiSign && (
                        <DropdownMenuItem
                          onClick={() => onWebPkiSign(letter)}
                          className="font-medium text-slate-900 focus:bg-slate-100 focus:text-slate-950"
                        >
                          <KeyRound className="size-4 text-slate-700" /> Assinar direto na web
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onSign(letter, "ONR")}>
                        <KeyRound className="size-4" /> Assinar com ONR
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSign(letter, "Adobe Acrobat")}>
                        <FilePenLine className="size-4" /> Assinar com Adobe Acrobat
                      </DropdownMenuItem>
                      {onAttachOnly && (
                        <DropdownMenuItem onClick={() => onAttachOnly(letter, "ONR")}>
                          <Upload className="size-4" /> Já assinei, anexar PDF
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onCopy(letter)}>
                        <Copy className="size-4" /> Copiar texto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPreview(letter, "text")}>
                        <Printer className="size-4" /> Imprimir / PDF
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-700">{value}</dd>
    </div>
  );
}
