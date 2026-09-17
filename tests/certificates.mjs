import {webcrypto} from "node:crypto";
import {Certificate,CertificateRevocationList,RevokedCertificate,RelativeDistinguishedNames,AttributeTypeAndValue,BasicConstraints,Extension,Time,CryptoEngine} from "pkijs";
import {Integer,Utf8String,BitString} from "asn1js";
export async function certificateFixture(){
 const engine=new CryptoEngine({name:"test",crypto:webcrypto});
 const algorithm={name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"};
 const rootKey=await webcrypto.subtle.generateKey(algorithm,true,["sign","verify"]);
 const leafKey=await webcrypto.subtle.generateKey(algorithm,true,["sign","verify"]);
 const name=(value)=>new RelativeDistinguishedNames({typesAndValues:[new AttributeTypeAndValue({type:"2.5.4.3",value:new Utf8String({value})})]});
 async function cert(serial,subject,key,ca){
  const c=new Certificate({version:2,serialNumber:new Integer({value:serial}),issuer:name("Test Root"),subject:name(subject)});
  c.notBefore.value=new Date(Date.now()-86400000);c.notAfter.value=new Date(Date.now()+86400000*30);
  await c.subjectPublicKeyInfo.importKey(key.publicKey,engine);
  const bc=new BasicConstraints({cA:ca});
  const ku=new BitString({unusedBits:ca?1:7,valueHex:new Uint8Array([ca?0x86:0x80]).buffer});
  c.extensions=[new Extension({extnID:"2.5.29.19",critical:true,extnValue:bc.toSchema().toBER(false),parsedValue:bc}),new Extension({extnID:"2.5.29.15",critical:true,extnValue:ku.toBER(false),parsedValue:ku})];
  await c.sign(rootKey.privateKey,"SHA-256",engine);return c;
 }
 const root=await cert(1,"Test Root",rootKey,true),leaf=await cert(2,"Pessoa Teste",leafKey,false);
 const crl=new CertificateRevocationList({version:1,issuer:root.subject,thisUpdate:new Time({type:0,value:new Date(Date.now()-60000)}),nextUpdate:new Time({type:0,value:new Date(Date.now()+86400000)})});
 await crl.sign(rootKey.privateKey,"SHA-256",engine);
 const pem=(object,label)=>"-----BEGIN "+label+"-----\n"+Buffer.from(object.toSchema().toBER(false)).toString("base64")+"\n-----END "+label+"-----";
 async function makeCrl({revoked=false,expired=false}={}) {
 const custom=new CertificateRevocationList({version:1,issuer:root.subject,thisUpdate:new Time({type:0,value:new Date(Date.now()-86400000*2)}),nextUpdate:new Time({type:0,value:new Date(Date.now()+(expired?-60000:86400000))}),...(revoked?{revokedCertificates:[new RevokedCertificate({userCertificate:leaf.serialNumber,revocationDate:new Time({type:0,value:new Date(Date.now()-86400000)})})]}:{})});
 await custom.sign(rootKey.privateKey,"SHA-256",engine);return custom;
 }
 return {makeCrl,root,leaf,crl,policy:{roots:[root],intermediates:[],crls:[crl]},raw:new Uint8Array(leaf.toSchema().toBER(false)),privateKey:leafKey.privateKey,rootPem:pem(root,"CERTIFICATE"),crlPem:pem(crl,"X509 CRL")};
}
