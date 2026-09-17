import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appUsers, auditEvents } from "@/db/schema";
import { withAccess } from "@/lib/access";
import { HttpError } from "@/lib/api";
const publicFields={id:appUsers.id,name:appUsers.name,email:appUsers.email,role:appUsers.role,active:appUsers.active};
export const GET=withAccess(async()=>Response.json({users:await getDb().select(publicFields).from(appUsers).orderBy(asc(appUsers.name))}),true);
const inputSchema=z.object({id:z.number().int().positive(),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),active:z.boolean()}).strict();
export const PATCH=withAccess(async(request,_context,actor)=>{
 const input=inputSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,"Informe um e-mail válido.");
 const user=await getDb().transaction(async(tx)=>{
  const [current]=await tx.select().from(appUsers).where(eq(appUsers.id,input.data.id)).for("update");
  if(!current)throw new HttpError(404,"Usuário não encontrado.");
  if(current.role==="admin")throw new HttpError(400,"O administrador principal não pode ser alterado nesta tela.");
  const [existing]=await tx.select({id:appUsers.id}).from(appUsers).where(eq(appUsers.email,input.data.email));
  if(existing&&existing.id!==current.id)throw new HttpError(409,"E-mail associado a outro usuário.");
  const emailChanged=current.email!==input.data.email;
  await tx.update(appUsers).set({email:input.data.email,active:input.data.active,authVersion:sql`${appUsers.authVersion}+1`,...(emailChanged?{passwordHash:null,emailVerifiedAt:null}:{})}).where(eq(appUsers.id,current.id));
  await tx.execute(sql`DELETE FROM auth_sessions WHERE user_id=${current.id}`);
  await tx.execute(sql`DELETE FROM auth_tokens WHERE user_id=${current.id}`);
  await tx.insert(auditEvents).values({actorEmail:actor.email,action:"user.access.updated",resourceId:String(current.id)});
  return (await tx.select(publicFields).from(appUsers).where(eq(appUsers.id,current.id)))[0];
 });
 return Response.json({user});
},true);
