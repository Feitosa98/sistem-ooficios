import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
export function token() { return randomBytes(32).toString("base64url"); }
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function otp() { return String(randomInt(0,1_000_000)).padStart(6,"0"); }
export function codeDigest(id: string, code: string) {
 const secret=process.env.AUTH_SECRET;
 if(!secret || secret.length<32) throw new Error("AUTH_SECRET não configurado.");
 return createHmac("sha256",secret).update(id+":"+code).digest("hex");
}
