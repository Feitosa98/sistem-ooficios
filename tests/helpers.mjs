import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
const require = createRequire(import.meta.url);
export const root = path.resolve(import.meta.dirname, "..");
export function harness() {
 const sqlite = new DatabaseSync(":memory:");
 for (const name of fs.readdirSync(path.join(root,"drizzle")).filter(n=>n.endsWith(".sql")).sort()) sqlite.exec(fs.readFileSync(path.join(root,"drizzle",name),"utf8"));
 const DB = { prepare(sql) {
  let values=[];
  const execute=()=>{ const stmt=sqlite.prepare(sql); const results=stmt.all(...values);return {success:true,results,meta:{changes:Number(sqlite.prepare("select changes() n").get().n)}};};
  return {bind(...args){ values=args;return this; },async all(){return execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...values);},async run(){return execute();}};
 },async batch(statements){sqlite.exec("BEGIN");try{const result=[];for(const stmt of statements)result.push(await stmt.all());sqlite.exec("COMMIT");return result;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
 const objects=new Map();
 const env={DB,BUCKET:{async put(key,bytes){objects.set(key,Uint8Array.from(bytes));},async get(key){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>Uint8Array.from(bytes).buffer,body:new Blob([bytes]).stream(),size:bytes.length}:null;},async delete(key){objects.delete(key);}}};
 let identity="iagofeitosa3@gmail.com";
 const mocks=new Map([["cloudflare:workers",{env}],["next/headers",{headers:async()=>new Headers(identity?{"oai-authenticated-user-email":identity}:{})}],["next/navigation",{redirect(){throw new Error("redirect");}}]]);
 const cache=new Map();
 function load(file){
   if(mocks.has(file))return mocks.get(file);
   let absolute=path.isAbsolute(file)?file:path.resolve(root,file);
   if(!path.extname(absolute)){if(fs.existsSync(absolute+".ts"))absolute+=".ts";else if(fs.existsSync(absolute+".tsx"))absolute+=".tsx";else absolute=path.join(absolute,"index.ts");}
   if(mocks.has(absolute))return mocks.get(absolute);
   if(cache.has(absolute))return cache.get(absolute).exports;
   const loaded={exports:{}};cache.set(absolute,loaded);
   const source=ts.transpileModule(fs.readFileSync(absolute,"utf8"),{fileName:absolute,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
   const localRequire=(specifier)=>{
    if(mocks.has(specifier))return mocks.get(specifier);
    if(specifier.endsWith("?inline")){const target=specifier.startsWith("@/")?path.resolve(root,specifier.slice(2,-7)):path.resolve(path.dirname(absolute),specifier.slice(0,-7));return "data:image/"+(target.endsWith(".png")?"png":"jpeg")+";base64,"+fs.readFileSync(target).toString("base64");}
    if(specifier.startsWith("@/"))return load(path.resolve(root,specifier.slice(2)));
    if(specifier.startsWith("."))return load(path.resolve(path.dirname(absolute),specifier));
    return require(specifier);
   };
   new Function("require","module","exports",source)(localRequire,loaded,loaded.exports);
   return loaded.exports;
 }
 return {load,env,sqlite,objects,mocks,cache,setIdentity(value){identity=value;},close(){sqlite.close();}};
}
export const letterData={number:1,year:2026,suffix:"",issueDate:"2026-09-16",department:"RI",subject:"Teste de integridade",reference:"",recipient:"Destinatário",recipientEmail:"",recipientRole:"",salutation:"Prezado(a),",body:"Texto original do ofício.",closing:"Atenciosamente,",signerName:"Pessoa Teste",signerRole:"Escrevente",status:"Rascunho",notes:""};
export function request(url="/api/oficios",method="GET",body){return new Request("https://app.test"+url,{method,headers:body instanceof FormData?{}:{"content-type":"application/json"},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});}
export const context=(id)=>({params:Promise.resolve({id:String(id)})});
export async function createLetter(h,changes={}){const res=await h.load("app/api/oficios/route.ts").POST(request("/api/oficios","POST",{...letterData,...changes}),{});if(res.status!==201)throw new Error(await res.text());return (await res.json()).letter;}
