import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import {harness,letterData,request,context,createLetter} from "./helpers.mjs";
import {certificateFixture} from "./certificates.mjs";
const fixture=await certificateFixture();
process.env.SIGNATURE_TRUSTED_ROOTS_PEM=fixture.rootPem;
process.env.SIGNATURE_CRLS_PEM=fixture.crlPem;
async function signed(h,letter=letterData){
 const raw=await h.load("lib/oficio-pdf.ts").generateOficioPdf(letter,h.load("lib/pdf-assets.ts").oficioAssets);
 const pades=h.load("lib/pades-signature.ts");const prepared=await pades.preparePdfForSignature(raw,letter.id||1,fixture.raw);
 const signature=Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",fixture.privateKey,prepared.session.signedAttributesDer)).toString("base64");
 const result=await pades.completePdfSignature(prepared.session,signature);
 return {...result,prepared,signature,raw};
}
test("real RSA CMS verifies; corrupt signatures, unsigned and post-sign changes fail",async()=>{
 const h=harness();try{
 const cert=h.load("lib/certificate-validation.ts");assert.equal((await cert.validateCertificate(fixture.raw,[],fixture.policy)).subjectCommonName,"Pessoa Teste");
 await assert.rejects(()=>cert.validateCertificate(fixture.raw,[],{...fixture.policy,crls:[]}));
 await assert.rejects(()=>cert.validateCertificate(fixture.raw,[],{...fixture.policy,roots:[]}));
 for (const crl of [await fixture.makeCrl({revoked:true}),await fixture.makeCrl({expired:true})]) await assert.rejects(()=>cert.validateCertificate(fixture.raw,[],{...fixture.policy,crls:[crl]}));
 assert.throws(()=>cert.certificateIdentity(new Uint8Array([1,2,3])));
 const data=await signed(h);const validate=h.load("lib/pdf-signature-validation.ts").validateSignedPdf;
 assert.equal((await validate(data.signedPdf,fixture.policy)).subjectCommonName,"Pessoa Teste");
 await assert.rejects(()=>validate(data.raw,fixture.policy));
 await assert.rejects(()=>validate(Buffer.concat([data.signedPdf,Buffer.from("\nchanged")]),fixture.policy));
 await assert.rejects(()=>h.load("lib/pades-signature.ts").completePdfSignature(data.prepared.session,Buffer.alloc(256).toString("base64")));
 const fingerprint=h.load("lib/pdf-integrity.ts").pdfContentFingerprint;
 assert.equal(await fingerprint(data.raw),await fingerprint(data.signedPdf));
 const changed=await PDFDocument.load(data.raw);changed.getPage(0).drawText("Alterado");assert.notEqual(await fingerprint(data.raw),await fingerprint(await changed.save()));
 }finally{h.close();}
});
test("valid signed PDF upload succeeds, stale and unsigned uploads are refused",async()=>{
 const h=harness();try{
 const letter=await createLetter(h);const data=await signed(h,letter);const route=h.load("app/api/oficios/[id]/signed-document/route.ts");
 const upload=async(bytes,version=1)=>{const form=new FormData();form.set("file",new File([bytes],"signed.pdf",{type:"application/pdf"}));form.set("version",String(version));form.set("provider","ONR");return route.POST(request("","POST",form),context(letter.id));};
 assert.equal((await upload(data.raw)).status,400);
 const res=await upload(data.signedPdf);assert.equal(res.status,200,await res.clone().text());
 const updated=(await res.json()).letter;assert.equal(updated.status,"Assinado");assert.ok(updated.signedFileKey);assert.equal(h.sqlite.prepare("select count(*) n from audit_events").get().n,1);
 assert.equal((await upload(data.signedPdf)).status,409);
 }finally{h.close();}
});
test("persisted sessions survive module reload and completion is idempotent",async()=>{
 const h=harness();try{
 const letter=await createLetter(h);const start=h.load("app/api/oficios/[id]/sign-direct/start/route.ts");
 const response=await start.POST(request("","POST",{version:1,certificate:Buffer.from(fixture.raw).toString("base64")}),context(letter.id));assert.equal(response.status,200,await response.clone().text());const info=await response.json();
 const saved=await h.load("lib/signature-storage.ts").readSession(info.sessionToken,letter.id,"iagofeitosa3@gmail.com");
 const signature=Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",fixture.privateKey,saved.session.signedAttributesDer)).toString("base64");
 h.cache.clear();const complete=h.load("app/api/oficios/[id]/sign-direct/complete/route.ts");
 const send=(extra={})=>complete.POST(request("","POST",{sessionToken:info.sessionToken,signature,...extra}),context(letter.id));
 assert.equal((await send({signerName:"Impostor"})).status,400);
 const res=await send();assert.equal(res.status,200,await res.clone().text());const record=(await res.json()).letter;
 await h.env.BUCKET.delete(saved.row.preparedFileKey);
 const repeated=await send();assert.equal(repeated.status,200);assert.equal((await repeated.json()).letter.signedFileKey,record.signedFileKey);
 assert.equal(h.sqlite.prepare("select count(*) n from audit_events").get().n,1);
 }finally{h.close();}
});
