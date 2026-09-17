import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const app = path.join(root, "hostinger");
const npm = process.env.npm_execpath;
if (!npm || !fs.existsSync(npm)) throw new Error("Execute este build com npm run build.");
function run(args, cwd) {
 const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit", env: process.env });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!fs.existsSync(path.join(app, "node_modules/next/dist/bin/next")) && process.env.OFICIOS_BUILD_SKIP_INSTALL !== "1") {
  run([npm, "ci", "--include=dev", "--no-audit", "--no-fund"], app);
}
run([path.join(app, "node_modules/next/dist/bin/next"), "build", "--webpack"], app);
const source = path.join(app, ".next");
const standalone = path.join(source, "standalone");
const server = path.join(standalone, "server.js");
if (!fs.existsSync(server) || !fs.existsSync(path.join(standalone, "node_modules/next/package.json"))) {
 throw new Error("Pacote standalone incompleto: servidor e dependências devem ficar juntos.");
}
const resolvedNext = createRequire(server).resolve("next/package.json");
if (!resolvedNext.startsWith(standalone + path.sep)) throw new Error("O pacote depende de arquivos externos.");
const destination = path.resolve(root, ".next");
if (path.relative(root, destination) !== ".next" || (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink())) {
 throw new Error("Destino de saída inválido.");
}
if (fs.existsSync(destination)) fs.rmSync(destination, {recursive:true,force:true});
fs.cpSync(source, destination, {recursive:true});
const delivered = path.join(destination, "standalone");
fs.cpSync(path.join(app, "public"), path.join(delivered, "public"), {recursive:true});
fs.cpSync(path.join(source, "static"), path.join(delivered, ".next/static"), {recursive:true});
console.log("Pacote Hostinger verificado: servidor, dependências, páginas e arquivos estáticos.");
