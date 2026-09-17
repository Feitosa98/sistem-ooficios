import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const derive = (password:string,salt:string) => new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export function passwordValid(value: unknown): value is string { return typeof value === "string" && value.length >= 8 && value.length <= 128; }
export async function hashPassword(password: string) {
 if(!passwordValid(password)) throw new Error("Use uma senha entre 8 e 128 caracteres.");
 const salt=randomBytes(16).toString("hex");
 const key=await derive(password,salt);
 return ["scrypt",salt,key.toString("hex")].join("$");
}
export async function verifyPassword(password: string, encoded: string | null) {
 const [algorithm,salt,digest]=(encoded || "").split("$");
 const valid=algorithm==="scrypt" && /^[a-f0-9]{32}$/.test(salt || "") && /^[a-f0-9]{128}$/.test(digest || "");
 const key=await derive(password.slice(0,128),valid?salt:"00000000000000000000000000000000");
 return valid && timingSafeEqual(key,Buffer.from(digest,"hex"));
}
