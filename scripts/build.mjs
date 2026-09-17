import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const hostingerDir = path.resolve(rootDir, "hostinger");

console.log("=========================================");
console.log("==> Iniciando build para Hostinger (Next.js Standalone)...");
console.log("=========================================");

if (fs.existsSync(hostingerDir)) {
  // 1. Instalar dependências em hostinger/ se necessário
  console.log("==> Verificando dependências em hostinger/...");
  execSync("npm --prefix hostinger install", { stdio: "inherit" });

  // 2. Executar build do Next.js com output standalone
  console.log("==> Executando next build em hostinger/...");
  execSync("npm --prefix hostinger run build", { stdio: "inherit" });

  // 3. Sincronizar .next gerado para a raiz
  const srcNext = path.join(hostingerDir, ".next");
  const destNext = path.join(rootDir, ".next");

  if (!fs.existsSync(srcNext)) {
    console.error("ERRO: hostinger/.next não encontrado.");
    process.exit(1);
  }

  console.log("==> Sincronizando pasta .next para a raiz...");
  if (fs.existsSync(destNext)) {
    fs.rmSync(destNext, { recursive: true, force: true });
  }
  fs.cpSync(srcNext, destNext, { recursive: true });
  console.log("==> Pasta .next sincronizada com a raiz com sucesso!");

  // 4. Configurar e nivelar estrutura standalone para detecção e execução da Hostinger
  const standaloneDir = path.join(destNext, "standalone");
  if (fs.existsSync(standaloneDir)) {
    console.log("==> Configurando arquivos standalone para Hostinger...");
    const hostingerStandalone = path.join(standaloneDir, "hostinger");
    const rootStandaloneServer = path.join(standaloneDir, "server.js");

    // Copiar server.js oficial do Next.js para a raiz de standalone (SEM WRAPPERS e SEM TOP-LEVEL AWAIT)
    const hostingerServerJs = path.join(hostingerStandalone, "server.js");
    if (fs.existsSync(hostingerServerJs)) {
      console.log("==> Instalando server.js nativo na raiz de .next/standalone/...");
      fs.cpSync(hostingerServerJs, rootStandaloneServer);
    }

    // Copiar conteúdo de .next de hostinger para standalone/.next
    const hostingerNextInStandalone = path.join(hostingerStandalone, ".next");
    const standaloneNextDir = path.join(standaloneDir, ".next");
    if (fs.existsSync(hostingerNextInStandalone)) {
      fs.cpSync(hostingerNextInStandalone, standaloneNextDir, { recursive: true });
    }

    // Copiar public para standalone e hostingerStandalone
    const srcPublic = path.join(hostingerDir, "public");
    if (fs.existsSync(srcPublic)) {
      fs.cpSync(srcPublic, path.join(standaloneDir, "public"), { recursive: true });
      if (fs.existsSync(hostingerStandalone)) {
        fs.cpSync(srcPublic, path.join(hostingerStandalone, "public"), { recursive: true });
      }
    }

    // Copiar .next/static para standalone/.next/static e hostingerStandalone/.next/static
    const srcStatic = path.join(destNext, "static");
    if (fs.existsSync(srcStatic)) {
      fs.cpSync(srcStatic, path.join(standaloneDir, ".next", "static"), { recursive: true });
      if (fs.existsSync(hostingerStandalone)) {
        fs.cpSync(srcStatic, path.join(hostingerStandalone, ".next", "static"), { recursive: true });
      }
    }

    // Também espelhar na pasta hostinger/.next/standalone para redundância total
    const hostingerNextStandalone = path.join(srcNext, "standalone");
    if (fs.existsSync(hostingerNextStandalone)) {
      if (fs.existsSync(rootStandaloneServer)) {
        fs.cpSync(rootStandaloneServer, path.join(hostingerNextStandalone, "server.js"));
      }
    }
  }

  // 5. Garantir que public está na raiz
  const srcPublic = path.join(hostingerDir, "public");
  const destPublic = path.join(rootDir, "public");
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, destPublic, { recursive: true });
  }

  // 6. Validar existência do standalone server
  const checkServer = path.join(destNext, "standalone", "server.js");
  if (fs.existsSync(checkServer)) {
    console.log("==> SUCESSO: Standalone server nativo verificado em:", checkServer);
  } else {
    console.error("ERRO: .next/standalone/server.js não foi encontrado!");
    process.exit(1);
  }

  console.log("=========================================");
  console.log("==> Build Standalone concluído com sucesso!");
  console.log("=========================================");
} else {
  console.log("==> Pasta hostinger não encontrada. Executando run-tool build...");
  execSync("node scripts/run-tool.mjs build", { stdio: "inherit" });
}
