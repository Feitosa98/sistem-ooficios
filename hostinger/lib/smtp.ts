import net from "node:net";
import tls from "node:tls";
import type { EmailConfig } from "./email";

export function smtpSend(config: EmailConfig, to: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket;
    let buffer = "";
    let done = false;
    let waiting: { codes: number[]; resolve: () => void; reject: (error: Error) => void } | undefined;
    const timer = setTimeout(() => fail(new Error("O servidor de e-mail não respondeu dentro do prazo.")), 30_000);
    function fail(error: Error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      waiting?.reject(error);
      waiting = undefined;
      socket?.destroy();
      reject(error);
    }
    function success() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.end("QUIT\r\n");
      resolve();
    }
    function consume() {
      while (waiting) {
        const end = buffer.indexOf("\r\n");
        if (end < 0) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const match = /^(\d{3})([- ])/.exec(line);
        if (!match || match[2] === "-") continue;
        const current = waiting;
        waiting = undefined;
        if (current.codes.includes(Number(match[1]))) current.resolve();
        else current.reject(new Error("O servidor de e-mail recusou a operação (código " + match[1] + ")."));
      }
    }
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 65536) return fail(new Error("Resposta SMTP excedeu o limite."));
      consume();
    };
    const onClose = () => fail(new Error("A conexão de e-mail foi encerrada antes da confirmação."));
    function attach() { socket.on("data", onData); socket.on("error", fail); socket.on("close", onClose); }
    function reply(codes: number[]) {
      return new Promise<void>((resolveReply, rejectReply) => {
        if (done) return rejectReply(new Error("Conexão encerrada."));
        waiting = { codes, resolve: resolveReply, reject: rejectReply }; consume();
      });
    }
    async function command(command: string, codes: number[]) {
      const result = reply(codes);
      socket.write(command + "\r\n");
      await result;
    }
    async function run() {
      if (!config.secure && config.port !== 587) throw new Error("Use TLS na porta 465 ou STARTTLS na porta 587.");
      socket = config.secure ? tls.connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true }) : net.createConnection({ host: config.host, port: config.port });
      attach();
      await reply([220]);
      await command("EHLO localhost", [250]);
      if (!config.secure) {
        await command("STARTTLS", [220]);
        socket.off("data", onData); socket.off("error", fail); socket.off("close", onClose);
        buffer = "";
        socket = tls.connect({ socket, servername: config.host, rejectUnauthorized: true });
        attach();
        await new Promise<void>((ready, error) => { socket.once("secureConnect", ready); socket.once("error", error); });
        await command("EHLO localhost", [250]);
      }
      await command("AUTH LOGIN", [334]);
      await command(Buffer.from(config.user).toString("base64"), [334]);
      await command(Buffer.from(config.pass).toString("base64"), [235]);
      await command("MAIL FROM:<" + config.from + ">", [250]);
      await command("RCPT TO:<" + to + ">", [250, 251]);
      await command("DATA", [354]);
      const accepted = reply([250]);
      socket.write(message.replace(/(^|\r\n)\./g, "$1..") + "\r\n.\r\n");
      await accepted;
      // Once DATA is accepted, a QUIT failure must not turn success into a retry.
      success();
    }
    void run().catch(fail);
  });
}
