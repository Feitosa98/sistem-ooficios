import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const hostingerDir = path.resolve(rootDir, "hostinger");

console.log("=========================================");
console.log("==> Iniciando build para Hostinger...");
console.log("=========================================");

if (fs.existsSync(hostingerDir)) {
  // 1. Instalar dependências em hostinger/ se necessário
  console.log("==> Verificando dependências em hostinger/...");
  execSync("npm --prefix hostinger install", { stdio: "inherit" });

  // 2. Executar build do Next.js
  console.log("==> Executando next build em hostinger/...");
  execSync("npm --prefix hostinger run build", { stdio: "inherit" });

  // 3. Copiar .next para a raiz para o detector da Hostinger
  const srcNext = path.join(hostingerDir, ".next");
  const destNext = path.join(rootDir, ".next");

  if (fs.existsSync(srcNext)) {
    console.log("==> Sincronizando pasta .next para a raiz...");
    if (fs.existsSync(destNext)) {
      fs.rmSync(destNext, { recursive: true, force: true });
    }
    fs.cpSync(srcNext, destNext, { recursive: true });
    console.log("==> Pasta .next sincronizada com a raiz com sucesso!");
  } else {
    console.error("ERRO: hostinger/.next não encontrado.");
    process.exit(1);
  }

  // 4. Sincronizar public se necessário
  const srcPublic = path.join(hostingerDir, "public");
  const destPublic = path.join(rootDir, "public");
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, destPublic, { recursive: true });
  }

  console.log("=========================================");
  console.log("==> Build concluído com sucesso!");
  console.log("=========================================");
} else {
  console.log("==> Pasta hostinger não encontrada. Executando run-tool build...");
  execSync("node scripts/run-tool.mjs build", { stdio: "inherit" });
}
