import { z } from "zod";
import { apiError,HttpError } from "@/lib/api";
import { checkOrigin,requestSetup,finishSetup,login,verifyMfa,logout } from "@/lib/auth/service";
export const runtime="nodejs";
const email=z.string().trim().email().max(254).transform(s=>s.toLowerCase());
const schemas={
 login:z.object({email,password:z.string().min(1).max(128)}),
 setup:z.object({email}),
 password:z.object({token:z.string().max(100),password:z.string().min(8).max(128)}),
 verify:z.object({challenge:z.string().max(100),code:z.string().regex(/^\d{6}$/)}),
};
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
 let response:Response;
 try{
  checkOrigin(request);
  if(Number(request.headers.get("content-length")||0)>4096)throw new HttpError(413,"Requisição muito grande.");
  const action=(await context.params).action;
  if(action==="logout"){await logout();response=Response.json({success:true});}
  else{
   const body=await request.text();
   if(body.length>4096)throw new HttpError(413,"Requisição muito grande.");
   const payload=JSON.parse(body);
   if(action==="login"){const input=schemas.login.parse(payload);response=Response.json(await login(input.email,input.password));}
   else if(action==="setup"){response=Response.json(await requestSetup(schemas.setup.parse(payload).email));}
   else if(action==="password"){const input=schemas.password.parse(payload);await finishSetup(input.token,input.password);response=Response.json({success:true});}
   else if(action==="verify"){const input=schemas.verify.parse(payload);await verifyMfa(input.challenge,input.code);response=Response.json({success:true});}
   else throw new HttpError(404,"Operação não encontrada.");
  }
 }catch(error){response=apiError(error instanceof z.ZodError?new HttpError(400,"Confira os campos informados."):error);}
 response.headers.set("Cache-Control","no-store");
 return response;
}
