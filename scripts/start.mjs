import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const hostingerDir = path.resolve(rootDir, "hostinger");

const targetDir = (fs.existsSync(hostingerDir) && fs.existsSync(path.join(hostingerDir, ".next")))
  ? "hostinger"
  : ".";

console.log(`==> Iniciando aplicação Next.js no diretório: ${targetDir} (Porta: ${process.env.PORT || 3000})...`);

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const child = targetDir === "hostinger"
  ? spawn(npmCmd, ["--prefix", "hostinger", "run", "start"], { stdio: "inherit", env: process.env })
  : spawn(npmCmd, ["run", "start"], { stdio: "inherit", env: process.env });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("Erro ao iniciar servidor:", err);
  process.exit(1);
});
