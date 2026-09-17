import test from "node:test";
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {harness} from "./helpers.mjs";
const config={secure:true,port:465,host:"smtp.example.com",user:"user",pass:"secret",from:"sender@example.com"};
function setup(mode="success"){
 const h=harness();let options;const commands=[];
 class Socket extends EventEmitter{
  write(value){commands.push(value);const codes=["250-multiline\r\n250 ready\r\n","334 user\r\n","334 password\r\n","235 ok\r\n","250 ok\r\n","250 ok\r\n","354 data\r\n","250 queued\r\n"];const response=codes[commands.length-1];if(response)setImmediate(()=>{this.emit("data",Buffer.from(response.slice(0,2)));this.emit("data",Buffer.from(response.slice(2)));});return true;}
  end(){this.emit("close");}
  destroy(){this.emit("close");}
 }
 h.mocks.set("node:tls",{connect(value){options=value;const socket=new Socket();setImmediate(()=>{if(mode==="success")socket.emit("data",Buffer.from("220 ready\r\n"));else if(mode==="close")socket.emit("close");else if(mode==="tls-error")socket.emit("error",new Error("certificate rejected"));});return socket;}});
 return {h,commands,options:()=>options,send:()=>h.load("lib/smtp.ts").smtpSend(config,"target@example.com","Body\r\n.dot")};
}
test("SMTP requires certificate validation, handles split replies and ignores close after DATA acceptance",async()=>{
 const {h,commands,options,send}=setup();try{await send();assert.equal(options().rejectUnauthorized,true);assert.equal(options().servername,config.host);assert.equal(commands.length,8);assert.match(commands[7],/\r\n\.\.dot/);}finally{h.close();}
});
test("SMTP closes and TLS failures reject promptly",async()=>{for(const mode of ["close","tls-error"]){const {h,send}=setup(mode);try{await assert.rejects(send);}finally{h.close();}}});
test("SMTP silence has a bounded timeout",async(t)=>{
 const {h,send}=setup("silent");try{t.mock.timers.enable({apis:["setTimeout"]});const pending=send();const assertion=assert.rejects(pending,/prazo/);t.mock.timers.tick(30001);await assertion;}finally{t.mock.timers.reset();h.close();}
});
