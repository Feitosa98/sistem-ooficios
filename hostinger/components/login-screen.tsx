import Image from "next/image";
import { FileText, LockKeyhole, ShieldCheck, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthForm } from "./auth-form";

export function LoginScreen({ status = 401, setup = false }: { status?: number; setup?: boolean }) {
  const pending = status === 403;
  const unavailable = status !== 401 && !pending;
  const title = setup ? "Confirme seu acesso." : pending ? "Acesso pendente" : unavailable ? "Voltamos em breve" : "Bem-vindo ao seu espaço de trabalho.";
  const description = pending
    ? "Sua conta foi identificada, mas o acesso ao sistema ainda precisa ser liberado pelo administrador."
    : unavailable
      ? "O sistema está temporariamente indisponível. Tente novamente em alguns instantes."
      : "Entre com sua conta autorizada para acessar os ofícios do cartório.";
  return (
    <main className="login-shell">
      <section className="login-brand" aria-label="2º Ofício de Manacapuru">
        <div className="login-brand-top">
          <span className="login-brand-symbol" aria-hidden="true"><FileText size={23} strokeWidth={1.5} /></span>
          <div><p className="login-wordmark">2º Ofício</p><p className="login-brand-location">MANACAPURU · AMAZONAS</p></div>
        </div>
        <div className="login-brand-copy">
          <p className="login-eyebrow">GESTÃO DOCUMENTAL</p>
          <h2>Formalidade em cada documento.<br /><span>Clareza em cada etapa.</span></h2>
          <p>Um espaço para elaborar, assinar e acompanhar a correspondência institucional.</p>
          <div className="login-workflow" aria-label="Etapas do ofício">
            <span>01 <strong>Elaborar</strong></span><span>02 <strong>Assinar</strong></span><span>03 <strong>Acompanhar</strong></span>
          </div>
        </div>
        <p className="login-brand-footer">2º Ofício de Registro de Imóveis, Títulos e Documentos<br />e Pessoas Jurídicas de Manacapuru/AM</p>
      </section>
      <section className="login-entry" aria-labelledby="login-title">
        <div className="login-card">
          <Image src="/logo-cartorio-transparente.png" alt="2º Ofício de Manacapuru" width={180} height={100} priority className="login-logo" />
          <p className="login-eyebrow login-system-name">Sistema de Ofícios</p>
          <h1 id="login-title">{title}</h1>
          <p className="login-description" role={pending || unavailable ? "status" : undefined}>{description}</p>
          {unavailable ? <Button asChild className="login-submit"><a href="/">Tentar novamente</a></Button> : <AuthForm setup={setup} />}
          <div className="login-access-note"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Acesso restrito à equipe</strong><span>Os documentos ficam disponíveis somente para usuários autorizados.</span></p></div>
          <details className="login-help">
            <summary><CircleHelp size={17} aria-hidden="true" />Precisa de ajuda para entrar?</summary>
            <p>Solicite ao administrador o cadastro do seu e-mail e a liberação do acesso. Para entrar, informe sua senha e o código de seis dígitos recebido por e-mail.</p>
          </details>
        </div>
        <footer className="login-entry-footer"><LockKeyhole size={13} aria-hidden="true" /><span>Ambiente institucional · 2º Ofício de Manacapuru</span></footer>
      </section>
    </main>
  );
}
