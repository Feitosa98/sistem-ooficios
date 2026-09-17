import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {Miniflare} from "miniflare";
import {certificateFixture} from "./certificates.mjs";
import {letterData} from "./helpers.mjs";
import {webcrypto} from "node:crypto";
test("compiled Worker runs access, D1 migrations and direct signatures in Cloudflare runtime", {timeout:60000}, async()=>{
 const fixture=await certificateFixture();
 const mf=new Miniflare({scriptPath:"dist/server/index.js",modules:true,modulesRules:[{type:"ESModule",include:["**/*.js","**/*.mjs"]}],compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],bindings:{SIGNATURE_TRUSTED_ROOTS_PEM:fixture.rootPem,SIGNATURE_CRLS_PEM:fixture.crlPem},d1Databases:["DB"],r2Buckets:["BUCKET"]});
 try{
 const db=await mf.getD1Database("DB");for(const name of fs.readdirSync("drizzle").filter(n=>n.endsWith(".sql")).sort()){const commands=fs.readFileSync("drizzle/"+name,"utf8").replaceAll("--> statement-breakpoint","").split(";").map(s=>s.trim()).filter(Boolean);await db.batch(commands.map(sql=>db.prepare(sql)));}
 let response=await mf.dispatchFetch("http://localhost/");assert.equal(response.status,200);assert.match(await response.text(),/Entrar com ChatGPT/);
 response=await mf.dispatchFetch("http://localhost/api/oficios");assert.equal(response.status,401);
 const headers={"oai-authenticated-user-email":"iagofeitosa3@gmail.com","content-type":"application/json"};
 const post=(url,data)=>mf.dispatchFetch("http://localhost"+url,{method:"POST",headers,body:JSON.stringify(data)});
 response=await post("/api/oficios",letterData);assert.equal(response.status,201,await response.clone().text());const letter=(await response.json()).letter;
 response=await mf.dispatchFetch("http://localhost/",{headers});assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/sistema está temporariamente indisponível/);
 response=await post("/api/oficios/"+letter.id+"/sign-direct/start",{version:1,certificate:Buffer.from(fixture.raw).toString("base64")});assert.equal(response.status,200,await response.clone().text());const start=await response.json();
 const session=await db.prepare("select data from signature_sessions where token=?").bind(start.sessionToken).first();
 const attrs=Buffer.from(JSON.parse(session.data).signedAttributesDer,"base64");const signature=Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",fixture.privateKey,attrs)).toString("base64");
 response=await post("/api/oficios/"+letter.id+"/sign-direct/complete",{sessionToken:start.sessionToken,signature});assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).letter.status,"Assinado");
 }finally{await mf.dispose();}
});
