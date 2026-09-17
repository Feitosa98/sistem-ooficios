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

  // 4. Configurar e validar estrutura standalone para detecção da Hostinger
  const standaloneDir = path.join(destNext, "standalone");
  if (fs.existsSync(standaloneDir)) {
    console.log("==> Configurando arquivos standalone para Hostinger...");
    const hostingerStandalone = path.join(standaloneDir, "hostinger");
    const rootStandaloneServer = path.join(standaloneDir, "server.js");

    // Garantir que .next/standalone/server.js existe (requisito do verificador da Hostinger)
    if (fs.existsSync(path.join(hostingerStandalone, "server.js")) && !fs.existsSync(rootStandaloneServer)) {
      console.log("==> Criando server.js na raiz de .next/standalone/...");
      const serverWrapper = `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "hostinger", "server.js");

if (fs.existsSync(target)) {
  await import("./hostinger/server.js");
} else {
  console.error("ERRO: Servidor standalone não encontrado em " + target);
  process.exit(1);
}
`;
      fs.writeFileSync(rootStandaloneServer, serverWrapper, "utf-8");
    }

    // Copiar public para standalone
    const srcPublic = path.join(hostingerDir, "public");
    if (fs.existsSync(srcPublic)) {
      fs.cpSync(srcPublic, path.join(standaloneDir, "public"), { recursive: true });
      if (fs.existsSync(hostingerStandalone)) {
        fs.cpSync(srcPublic, path.join(hostingerStandalone, "public"), { recursive: true });
      }
    }

    // Copiar .next/static para standalone/.next/static
    const srcStatic = path.join(destNext, "static");
    if (fs.existsSync(srcStatic)) {
      fs.cpSync(srcStatic, path.join(standaloneDir, ".next", "static"), { recursive: true });
      if (fs.existsSync(hostingerStandalone)) {
        fs.cpSync(srcStatic, path.join(hostingerStandalone, ".next", "static"), { recursive: true });
      }
    }

    // Também espelhar na pasta hostinger/.next/standalone para redundância total
    const hostingerNextStandalone = path.join(srcNext, "standalone");
    if (fs.existsSync(hostingerNextStandalone) && !fs.existsSync(path.join(hostingerNextStandalone, "server.js"))) {
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
    console.log("==> SUCESSO: Standalone server verificado em:", checkServer);
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
