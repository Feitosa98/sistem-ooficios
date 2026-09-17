import { sessionUser, checkOrigin } from "./auth/service";
import { apiError,HttpError } from "./api";
export type AccessUser = { email: string; displayName: string; fullName: string|null; role:"admin"|"operator" };
export async function requireAccess(admin=false):Promise<AccessUser>{
 const user=await sessionUser();
 if(!user)throw new HttpError(401,"Entre na sua conta para acessar o sistema.");
 if(admin&&user.role!=="admin")throw new HttpError(403,"Esta operação é exclusiva do administrador.");
 return user;
}
export function withAccess<C>(handler:(request:Request,context:C,user:AccessUser)=>Promise<Response>,admin=false){
 return async(request:Request,context:C):Promise<Response>=>{
  let response:Response;
  try{
   if(!["GET","HEAD"].includes(request.method))checkOrigin(request);
   response=await handler(request,context,await requireAccess(admin));
  }catch(error){response=apiError(error);}
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
 };
}
