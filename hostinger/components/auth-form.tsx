"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function AuthForm({ setup=false }: { setup?:boolean }) {
 const [mode,setMode]=useState<"login"|"request"|"mfa"|"password"|"done">(setup?"password":"login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[code,setCode]=useState("");
 const [challenge,setChallenge]=useState(""),[setupToken,setSetupToken]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{if(setup){const token=new URLSearchParams(window.location.hash.slice(1)).get("token")||"";setSetupToken(token);window.history.replaceState(null,"",window.location.pathname);}},[setup]);
 async function submit(event:FormEvent){
  event.preventDefault();setError("");setMessage("");setBusy(true);
  try{
   if(mode==="password"&&password!==confirm)throw new Error("As senhas precisam ser iguais.");
   const action=mode==="request"?"setup":mode==="password"?"password":mode==="mfa"?"verify":"login";
   const body=mode==="request"?{email}:mode==="password"?{token:setupToken,password}:mode==="mfa"?{challenge,code}:{email,password};
   const response=await fetch("/api/auth/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Não foi possível concluir.");
   if(mode==="login"){setChallenge(result.challenge);setPassword("");setMode("mfa");}
   else if(mode==="mfa"){window.location.replace("/");}
   else if(mode==="password"){setPassword("");setConfirm("");setSetupToken("");setMode("done");}
   else setMessage(result.message);
  }catch(error){setError(error instanceof Error?error.message:"Tente novamente.");}finally{setBusy(false);}
 }
 function back(){setMode("login");setPassword("");setCode("");setError("");setMessage("");}
 if(mode==="done")return <div className="auth-fields"><p role="status">E-mail confirmado e senha salva. Entre para receber seu código de acesso.</p><Button asChild className="login-submit"><a href="/">Ir para o login</a></Button></div>;
 return <form onSubmit={submit} className="auth-fields">
  {mode==="mfa"?<><p className="auth-note">Enviamos um código para <strong>{email}</strong>. Ele expira em dez minutos.</p><label htmlFor="auth-code">Código de confirmação</label><Input id="auth-code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="000000" className="auth-code" /></>
   :mode==="password"?<><p className="auth-note">Defina uma senha com pelo menos 12 caracteres.</p><label htmlFor="auth-new-password">Nova senha</label><Input id="auth-new-password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /><label htmlFor="auth-confirm">Confirmar senha</label><Input id="auth-confirm" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></>
   :<><label htmlFor="auth-email">E-mail</label><Input id="auth-email" type="email" required autoComplete="username" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" />{mode==="login"&&<><label htmlFor="auth-password">Senha</label><Input id="auth-password" required type="password" maxLength={128} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></>}</>}
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {message&&<p role="status" className="auth-note">{message}</p>}
  <Button type="submit" disabled={busy||(mode==="password"&&!setupToken)} className="login-submit">{busy?"Aguarde…":mode==="mfa"?"Confirmar e entrar":mode==="password"?"Confirmar e-mail e salvar senha":mode==="request"?"Enviar link de confirmação":"Entrar"}</Button>
  {mode==="login"?<button type="button" className="auth-link" onClick={()=>{setMode("request");setError("");}}>Primeiro acesso ou esqueci minha senha</button>:<button type="button" className="auth-link" disabled={busy} onClick={back}>Voltar para o login</button>}
 </form>;
}
