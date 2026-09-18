import test from "node:test";
import assert from "node:assert/strict";
import {harness,request,context,createLetter} from "./helpers.mjs";
test("migration seeds only confirmed administrator; access and admin boundaries",async()=>{
 const h=harness();try{
 const api=h.load("app/api/oficios/route.ts");
 h.setIdentity(null);assert.equal((await api.GET(request(),{})).status,401);
 h.setIdentity("unknown@example.com");assert.equal((await api.GET(request(),{})).status,403);
 h.setIdentity("iagofeitosa3@gmail.com");assert.equal((await api.GET(request(),{})).status,200);
 const users=h.sqlite.prepare("select * from app_users").all();assert.equal(users.length,6);assert.equal(users.filter(u=>u.active).length,1);
 h.sqlite.prepare("update app_users set email=?,active=1 where id=1").run("operator@example.com");h.setIdentity("operator@example.com");
 assert.equal((await h.load("app/api/configuracoes/email/route.ts").GET(request(),{})).status,403);
 assert.equal((await h.load("app/api/usuarios/route.ts").GET(request(),{})).status,403);
 const cross=new Request("https://app.test/api/oficios",{method:"POST",headers:{origin:"https://evil.test"},body:"{}"});assert.equal((await api.POST(cross,{})).status,403);
 }finally{h.close();}
});
test("pagination and search include records beyond the old 500 limit",async()=>{
 const h=harness();try{const first=await createLetter(h);
 const stmt=h.sqlite.prepare("insert into letters(number,year,issue_date,department,subject,recipient,body,signer_name,signer_role) values(?,2026,'2026-09-16','RI',?,'Pessoa','Corpo','Pessoa Teste','Escrevente')");
 for(let n=2;n<=610;n++)stmt.run(n,"Assunto "+n);
 const api=h.load("app/api/oficios/route.ts");
 let body=await (await api.GET(request("/api/oficios?page=7&pageSize=100"),{})).json();assert.equal(body.total,610);assert.equal(body.letters.length,10);assert.equal(body.nextNumber,611);assert.equal(body.counts.Rascunho,610);
 body=await(await api.GET(request("/api/oficios?q=Teste%20de%20integridade"),{})).json();assert.equal(body.total,1);assert.equal(body.letters[0].id,first.id);
 }finally{h.close();}
});
test("version checks reject stale updates, invalid status and edits after signature",async()=>{
 const h=harness();try{const letter=await createLetter(h);const api=h.load("app/api/oficios/[id]/route.ts");
 assert.equal((await api.PATCH(request("","PATCH",{version:1,status:"Assinado"}),context(letter.id))).status,409);
 const res=await api.PATCH(request("","PATCH",{version:1,subject:"Alterado"}),context(letter.id));assert.equal(res.status,200);assert.equal((await res.json()).letter.version,2);
 assert.equal((await api.PATCH(request("","PATCH",{version:1,subject:"Antigo"}),context(letter.id))).status,409);
 h.sqlite.prepare("update letters set signed_file_key='signed',status='Assinado' where id=?").run(letter.id);
 assert.equal((await api.PATCH(request("","PATCH",{version:2,body:"Substituído"}),context(letter.id))).status,409);
 const pdf=await h.load("app/api/oficios/[id]/pdf/route.ts").GET(request(),context(letter.id));assert.equal(pdf.status,404);
 }finally{h.close();}
});
test("PKI secrets never return to browser and blank saves preserve existing secrets",async()=>{
 const h=harness();try{h.sqlite.prepare("insert into system_settings(key,value) values('pki_settings',?)").run(JSON.stringify({licenseKey:"public-license",restPkiToken:"PRIVATE",restPkiUrl:"https://pki.rest/"}));
 const api=h.load("app/api/configuracoes/pki/route.ts");let res=await api.GET(request(),{});assert.doesNotMatch(await res.text(),/PRIVATE/);
 res=await api.POST(request("","POST",{licenseKey:"changed",restPkiToken:""}),{});assert.equal(res.status,200);assert.doesNotMatch(await res.text(),/PRIVATE/);
 assert.match(h.sqlite.prepare("select value from system_settings where key='pki_settings'").get().value,/PRIVATE/);
 }finally{h.close();}
});
test("duplicate email requests send once; uncertain result blocks retries",async()=>{
 const h=harness();try{
 let count=0;let fail=false;
 // Resolve platform path without depending on URL drive formatting.
 const {fileURLToPath}=await import("node:url");h.mocks.set(fileURLToPath(new URL("../lib/email.ts",import.meta.url)),{getReadyEmailConfig:async()=>({}),sendEmail:async()=>{count++;if(fail)throw new Error("timeout");return {success:true};}});
 const letter=await createLetter(h);h.sqlite.prepare("update letters set status='Assinado',signed_file_key='signed' where id=?").run(letter.id);await h.env.BUCKET.put("signed",new Uint8Array([1,2,3]));
 const api=h.load("app/api/oficios/[id]/enviar-email/route.ts");const payload={recipientEmail:"person@example.com",subject:"Ofício",body:"Segue"};
 assert.equal((await api.POST(request("","POST",payload),context(letter.id))).status,200);
 assert.equal((await api.POST(request("","POST",payload),context(letter.id))).status,200);assert.equal(count,1);
 fail=true;payload.recipientEmail="second@example.com";assert.equal((await api.POST(request("","POST",payload),context(letter.id))).status,502);assert.equal((await api.POST(request("","POST",payload),context(letter.id))).status,409);assert.equal(count,2);
 }finally{h.close();}
});

test("missing mail configuration does not consume a delivery attempt",async()=>{
 const h=harness();try{const letter=await createLetter(h);h.sqlite.prepare("update letters set status='Assinado',signed_file_key='signed' where id=?").run(letter.id);await h.env.BUCKET.put("signed",new Uint8Array([1]));
 const api=h.load("app/api/oficios/[id]/enviar-email/route.ts");const res=await api.POST(request("","POST",{recipientEmail:"person@example.com",subject:"Ofício",body:"Segue"}),context(letter.id));assert.equal(res.status,400);assert.equal(h.sqlite.prepare("select count(*) n from email_deliveries").get().n,0);
 }finally{h.close();}
});

test("employees administration allows create, edit and delete with security guards",async()=>{
 const h=harness();try{
 h.setIdentity("iagofeitosa3@gmail.com");
 const api=h.load("app/api/usuarios/route.ts");

 const createRes=await api.POST(request("/api/usuarios","POST",{
  name:"Novo Funcionário",
  email:"novo@example.com",
  role:"operator",
  active:true,
 }),{});
 assert.equal(createRes.status,201);
 const created=(await createRes.json()).user;
 assert.equal(created.name,"Novo Funcionário");
 assert.equal(created.email,"novo@example.com");
 assert.equal(created.role,"operator");
 assert.equal(Boolean(created.active),true);

 const dupRes=await api.POST(request("/api/usuarios","POST",{
  name:"Outro",
  email:"novo@example.com",
 }),{});
 assert.equal(dupRes.status,409);

 const editRes=await api.PATCH(request("/api/usuarios","PATCH",{
  id:created.id,
  name:"Funcionário Alterado",
  role:"admin",
  active:true,
 }),{});
 assert.equal(editRes.status,200);
 const updated=(await editRes.json()).user;
 assert.equal(updated.name,"Funcionário Alterado");
 assert.equal(updated.role,"admin");

 const delRes=await api.DELETE(request(`/api/usuarios?id=${created.id}`,"DELETE"),{});
 assert.equal(delRes.status,200);

 const adminUser=h.sqlite.prepare("select id from app_users where role='admin' and active=1").get();
 const demoteRes=await api.PATCH(request("/api/usuarios","PATCH",{
  id:adminUser.id,
  role:"operator",
 }),{});
 assert.equal(demoteRes.status,400);

 const selfDel=await api.DELETE(request(`/api/usuarios?id=${adminUser.id}`,"DELETE"),{});
 assert.equal(selfDel.status,400);
 }finally{h.close();}
});

