import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcImg = path.join(rootDir, "public", "marca-dagua-cartorio.png");

async function generate() {
  console.log("==> Gerando ícones a partir de marca-dagua-cartorio.png...");

  // 1. Extrair o símbolo (caneta tinteiro e onda)
  const symbolBuf = await sharp(srcImg)
    .extract({ left: 245, top: 180, width: 297, height: 574 })
    .resize(null, 390)
    .toBuffer();

  const meta = await sharp(symbolBuf).metadata();
  const padX = Math.round((512 - meta.width) / 2);
  const padY = Math.round((512 - meta.height) / 2);

  // 2. Criar ícone com fundo institucional (badge)
  const bgSvg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18181b"/>
          <stop offset="100%" stop-color="#09090b"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#grad)"/>
      <rect x="18" y="18" width="476" height="476" rx="94" fill="none" stroke="#c4a35a" stroke-width="4" opacity="0.45"/>
    </svg>
  `);

  const badge512 = await sharp(bgSvg)
    .composite([{ input: symbolBuf, left: padX, top: padY }])
    .png()
    .toBuffer();

  // 3. Criar versão transparente 512
  const trans512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{ input: symbolBuf, left: padX, top: padY }])
  .png()
  .toBuffer();

  const targetDirs = [
    path.join(rootDir, "public"),
    path.join(rootDir, "hostinger", "public")
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;

    // Salvar icon.png (badge 192x192 e 512x512)
    await sharp(badge512).resize(512, 512).toFile(path.join(dir, "icon-512.png"));
    await sharp(badge512).resize(192, 192).toFile(path.join(dir, "icon-192.png"));
    await sharp(badge512).resize(180, 180).toFile(path.join(dir, "apple-touch-icon.png"));
    await sharp(badge512).resize(48, 48).toFile(path.join(dir, "icon-48.png"));
    await sharp(badge512).resize(32, 32).toFile(path.join(dir, "icon.png"));
    await sharp(badge512).resize(32, 32).toFile(path.join(dir, "favicon-32.png"));
    await sharp(badge512).resize(16, 16).toFile(path.join(dir, "favicon-16.png"));

    // Salvar versão transparente do símbolo
    await sharp(trans512).resize(128, 128).toFile(path.join(dir, "simbolo-cartorio.png"));

    // Converter badge para base64 para incluir em favicon.svg vetorizado
    const b64 = badge512.toString("base64");
    const svgFavicon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,${b64}" width="512" height="512"/>
</svg>
`;
    fs.writeFileSync(path.join(dir, "favicon.svg"), svgFavicon, "utf-8");
  }

  // Também salvar em hostinger/app para detecção automática do Next.js App Router
  const appDirs = [
    path.join(rootDir, "app"),
    path.join(rootDir, "hostinger", "app")
  ];
  for (const appDir of appDirs) {
    if (!fs.existsSync(appDir)) continue;
    await sharp(badge512).resize(32, 32).toFile(path.join(appDir, "icon.png"));
    await sharp(badge512).resize(180, 180).toFile(path.join(appDir, "apple-icon.png"));
  }

  console.log("==> Todos os ícones foram gerados com sucesso!");
}

generate().catch(console.error);
