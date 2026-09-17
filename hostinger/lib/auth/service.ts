import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPool } from "@/db";
import type { RowDataPacket } from "mysql2/promise";
import { HttpError } from "@/lib/api";
import { hashPassword, passwordValid, verifyPassword } from "./password";
import { token, digest, otp, codeDigest } from "./tokens";
import { sendAuthMail } from "./mail";
export const SESSION_COOKIE = "oficios_session";
export function appOrigin() {
 const url = new URL(process.env.APP_URL || "http://localhost:3001");
 if(process.env.NODE_ENV==="production" && url.protocol!=="https:") throw new HttpError(503,"O endereço seguro do sistema precisa ser configurado.");
 return url.origin;
}
export function checkOrigin(request: Request) {
 if(request.headers.get("origin") !== appOrigin() || request.headers.get("sec-fetch-site")==="cross-site") throw new HttpError(403,"Origem da requisição não permitida.");
}
async function throttle(scope: string, limit: number, duration: number) {
 const connection=await getPool().getConnection();
 const now=Date.now(); const key=digest(scope);
 try {
  await connection.beginTransaction();
  await connection.execute("INSERT INTO auth_limits (scope_key,hits,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=IF(reset_at<=?,1,hits+1),reset_at=IF(reset_at<=?,VALUES(reset_at),reset_at)",[key,now+duration,now,now]);
  const [rows]=await connection.execute<RowDataPacket[]>("SELECT hits FROM auth_limits WHERE scope_key=?",[key]);
  await connection.commit();
  if(Number(rows[0].hits)>limit) throw new HttpError(429,"Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
 } catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
export async function requestSetup(email: string) {
 await throttle("setup-global",60,60_000);
 await throttle("setup:"+email,3,60*60_000);
 const [rows]=await getPool().execute<RowDataPacket[]>("SELECT id FROM app_users WHERE email=? AND active=1",[email]);
 if(!rows[0])return;
 const raw=token(), id=digest(raw);
 await getPool().execute("INSERT INTO auth_tokens (id,user_id,kind,expires_at) VALUES (?,?,'setup',?)",[id,rows[0].id,Date.now()+30*60_000]);
 try {
  await sendAuthMail(email,"Confirme seu e-mail — Sistema de Ofícios","Para confirmar seu e-mail e definir uma senha, abra o endereço abaixo. O link expira em 30 minutos e só pode ser usado uma vez.\n\n"+appOrigin()+"/acesso#token="+raw+"\n\nSe você não solicitou o acesso, ignore esta mensagem.");
 }catch(error){await getPool().execute("DELETE FROM auth_tokens WHERE id=?",[id]);throw error;}
}
export async function finishSetup(raw: string, password: string) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw) || !passwordValid(password))throw new HttpError(400,"Use o link recebido por e-mail e uma senha entre 12 e 128 caracteres.");
 await throttle("finish-setup-global",30,60_000);
 const passwordHash=await hashPassword(password);
 const connection=await getPool().getConnection();
 try {
  await connection.beginTransaction();
  const [rows]=await connection.execute<RowDataPacket[]>("SELECT t.user_id FROM auth_tokens t JOIN app_users u ON u.id=t.user_id WHERE t.id=? AND t.kind='setup' AND t.expires_at>? AND u.active=1 FOR UPDATE",[digest(raw),Date.now()]);
  if(!rows[0])throw new HttpError(400,"Link inválido ou expirado. Solicite um novo link.");
  const id=rows[0].user_id;
  await connection.execute("UPDATE app_users SET password_hash=?,email_verified_at=UTC_TIMESTAMP(),auth_version=auth_version+1 WHERE id=?",[passwordHash,id]);
  await connection.execute("DELETE FROM auth_sessions WHERE user_id=?",[id]);
  await connection.execute("DELETE FROM auth_tokens WHERE user_id=?",[id]);
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
export async function login(email: string, password: string) {
 await throttle("login-global",60,60_000);
 await throttle("login:"+email,6,15*60_000);
 const [rows]=await getPool().execute<RowDataPacket[]>("SELECT id,email,password_hash,email_verified_at,auth_version,active FROM app_users WHERE email=?",[email]);
 const user=rows[0];
 const valid=await verifyPassword(password,user?.password_hash || null);
 if(!valid || !user?.active || !user.email_verified_at)throw new HttpError(401,"E-mail ou senha inválidos, ou acesso ainda não confirmado.");
 const challenge=token(), code=otp(), id=digest(challenge);
 await getPool().execute("INSERT INTO auth_tokens(id,user_id,kind,code_hash,auth_version,expires_at) VALUES(?,?,'mfa',?,?,?)",[id,user.id,codeDigest(id,code),user.auth_version,Date.now()+10*60_000]);
 try {await sendAuthMail(email,"Código de acesso — Sistema de Ofícios","Seu código de confirmação é: "+code+"\n\nVálido por 10 minutos. Não compartilhe este código. Se você não tentou entrar, altere sua senha pelo sistema.");}
 catch(error){await getPool().execute("DELETE FROM auth_tokens WHERE id=?",[id]);throw error;}
 return challenge;
}
export async function verifyMfa(challenge: string, code: string) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(challenge)||!/^\d{6}$/.test(code))throw new HttpError(400,"Informe o código de seis dígitos.");
 const id=digest(challenge), raw=token();
 const connection=await getPool().getConnection();
 try {
  await connection.beginTransaction();
  const [rows]=await connection.execute<RowDataPacket[]>("SELECT t.*,u.active,u.auth_version AS current_version,u.email_verified_at FROM auth_tokens t JOIN app_users u ON u.id=t.user_id WHERE t.id=? AND t.kind='mfa' FOR UPDATE",[id]);
  const row=rows[0];
  if(!row||!row.active||!row.email_verified_at||row.auth_version!==row.current_version||Number(row.expires_at)<=Date.now()||row.attempts>=5)throw new HttpError(400,"Código expirado ou limite de tentativas atingido. Entre novamente.");
  if(!timingSafeEqual(Buffer.from(row.code_hash,"hex"),Buffer.from(codeDigest(id,code),"hex"))){
   await connection.execute("UPDATE auth_tokens SET attempts=attempts+1 WHERE id=?",[id]);
   await connection.commit();
   throw new HttpError(400,"Código incorreto. Confira o e-mail e tente novamente.");
  }
  await connection.execute("DELETE FROM auth_tokens WHERE id=?",[id]);
  await connection.execute("INSERT INTO auth_sessions(id,user_id,auth_version,expires_at) VALUES(?,?,?,?)",[digest(raw),row.user_id,row.current_version,Date.now()+8*60*60_000]);
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 const jar=await cookies();
 jar.set(SESSION_COOKIE,raw,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:8*60*60});
}
export async function sessionUser() {
 const raw=(await cookies()).get(SESSION_COOKIE)?.value;
 if(!raw||!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const [rows]=await getPool().execute<RowDataPacket[]>("SELECT u.id,u.name,u.email,u.role FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>? AND s.auth_version=u.auth_version AND u.active=1 AND u.email_verified_at IS NOT NULL",[digest(raw),Date.now()]);
 if(!rows[0])return null;
 const row=rows[0];return {id:Number(row.id),email:String(row.email),displayName:String(row.name),fullName:String(row.name),role:row.role==="admin"?"admin" as const:"operator" as const};
}
export async function logout() {
 const jar=await cookies(),raw=jar.get(SESSION_COOKIE)?.value;
 if(raw)await getPool().execute("DELETE FROM auth_sessions WHERE id=?",[digest(raw)]);
 jar.set(SESSION_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}
