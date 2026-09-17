import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

export type OficioPdfData = {
  number: number;
  year: number;
  suffix: string;
  issueDate: string;
  department: string;
  subject: string;
  reference: string;
  recipient: string;
  recipientRole: string;
  salutation: string;
  body: string;
  closing: string;
  signerName: string;
  signerRole: string;
};

export type DigitalSignatureStamp = {
  signerName?: string;
  date?: Date;
  cpf?: string;
  issuer?: string;
};

type PdfAssets = {
  logo?: Uint8Array;
  watermark?: Uint8Array;
  digitalSignature?: DigitalSignatureStamp;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 61;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const GOLD = rgb(0.65, 0.53, 0.27);
const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.28, 0.28, 0.28);

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2022\u00b7]/g, "-")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, "");
}

function oficioNumber(letter: OficioPdfData) {
  const base = `${String(letter.number).padStart(3, "0")}/${letter.year}`;
  return letter.suffix ? `${base} - ${safeText(letter.suffix)}` : base;
}

function longDate(value: string) {
  if (!value) return "[DATA]";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return safeText(value);
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${String(day).padStart(2, "0")} de ${months[month - 1]} de ${year}`;
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const chunks: string[] = [];
  let chunk = "";
  for (const char of word) {
    if (chunk && font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk += char;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
  firstWidth = width,
) {
  const rawWords = safeText(text).trim().split(/\s+/).filter(Boolean);
  const words = rawWords.flatMap((word) =>
    font.widthOfTextAtSize(word, size) > width
      ? splitLongWord(word, font, size, width)
      : [word],
  );
  if (!words.length) return [""];

  const lines: string[] = [];
  let line = "";
  let maxWidth = firstWidth;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
      maxWidth = width;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const clean = safeText(text);
  const width = font.widthOfTextAtSize(clean, size);
  page.drawText(clean, { x: (PAGE_WIDTH - width) / 2, y, font, size, color });
}

function drawRight(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
) {
  const clean = safeText(text);
  const width = font.widthOfTextAtSize(clean, size);
  page.drawText(clean, {
    x: PAGE_WIDTH - MARGIN_X - width,
    y,
    font,
    size,
    color: INK,
  });
}

function drawJustifiedLine(
  page: PDFPage,
  line: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
) {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    page.drawText(line, { x, y, font, size, color: INK });
    return;
  }
  const wordsWidth = words.reduce(
    (total, word) => total + font.widthOfTextAtSize(word, size),
    0,
  );
  const gap = Math.max(2, (width - wordsWidth) / (words.length - 1));
  let cursor = x;
  for (const word of words) {
    page.drawText(word, { x: cursor, y, font, size, color: INK });
    cursor += font.widthOfTextAtSize(word, size) + gap;
  }
}

function scaledImage(image: PDFImage, width: number) {
  const scale = width / image.width;
  return { width, height: image.height * scale };
}

export async function generateOficioPdf(
  letter: OficioPdfData,
  assets: PdfAssets = {},
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ofício nº ${oficioNumber(letter)}`);
  pdf.setAuthor("2º Ofício de Manacapuru - AM");
  pdf.setSubject(safeText(letter.subject));
  pdf.setCreator("Sistema de Ofícios");
  pdf.setProducer("Sistema de Ofícios");

  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | undefined;
  let watermark: PDFImage | undefined;
  if (assets.logo) logo = await pdf.embedJpg(assets.logo);
  if (assets.watermark) watermark = await pdf.embedPng(assets.watermark);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 0;

  const drawPageFrame = (continuation = false) => {
    if (continuation) page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (watermark) {
      const size = scaledImage(watermark, 363);
      page.drawImage(watermark, {
        x: (PAGE_WIDTH - size.width) / 2,
        y: PAGE_HEIGHT - 210 - size.height,
        ...size,
        opacity: 0.18,
      });
    }
    if (logo) {
      const size = scaledImage(logo, 112);
      page.drawImage(logo, { x: 42, y: 716, ...size });
    }
    const headerLines = [
      "ESTADO DO AMAZONAS",
      "CARTÓRIO EXTRAJUDICIAL",
      "2º OFÍCIO DE MANACAPURU - AM",
      "PAULO HENRIQUE FELBERK DE ALMEIDA",
      "OFICIAL REGISTRADOR",
    ];
    headerLines.forEach((line, index) =>
      drawCentered(page, line, 773 - index * 13, bold, 10.2),
    );

    page.drawLine({
      start: { x: 46, y: 48 },
      end: { x: PAGE_WIDTH - 46, y: 48 },
      thickness: 0.75,
      color: GOLD,
    });
    drawCentered(
      page,
      "Av. Ribeiro Júnior, nº 373, Centro, Manacapuru/AM - CEP 69.400-366",
      34,
      regular,
      7.8,
      MUTED,
    );
    drawCentered(
      page,
      "RI/RTDPJ: ri.tdpj2oficio@gmail.com | RCPN: rcpn2oficio@gmail.com",
      23,
      regular,
      7.8,
      MUTED,
    );
    drawRight(page, String(pdf.getPageCount()), 23, regular, 7.4);
    y = continuation ? 675 : 655;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 72) drawPageFrame(true);
  };

  const drawParagraph = (
    text: string,
    options: { indent?: number; justify?: boolean; gapAfter?: number } = {},
  ) => {
    const clean = safeText(text).trim();
    if (!clean) return;
    const fontSize = 11.5;
    const lineHeight = 17;
    const indent = options.indent ?? 0;
    const lines = wrapText(
      clean,
      regular,
      fontSize,
      CONTENT_WIDTH,
      CONTENT_WIDTH - indent,
    );
    lines.forEach((line, index) => {
      ensureSpace(lineHeight);
      const first = index === 0;
      const x = MARGIN_X + (first ? indent : 0);
      const width = CONTENT_WIDTH - (first ? indent : 0);
      if (options.justify && index < lines.length - 1) {
        drawJustifiedLine(page, line, x, y, width, regular, fontSize);
      } else {
        page.drawText(line, { x, y, font: regular, size: fontSize, color: INK });
      }
      y -= lineHeight;
    });
    y -= options.gapAfter ?? 9;
  };

  const drawLabeled = (label: string, value: string) => {
    const clean = safeText(value).trim();
    if (!clean) return;
    const size = 11.5;
    const lineHeight = 17;
    const labelText = `${safeText(label)}: `;
    const labelWidth = bold.widthOfTextAtSize(labelText, size);
    const lines = wrapText(
      clean,
      regular,
      size,
      CONTENT_WIDTH,
      CONTENT_WIDTH - labelWidth,
    );
    lines.forEach((line, index) => {
      ensureSpace(lineHeight);
      if (index === 0) {
        page.drawText(labelText, { x: MARGIN_X, y, font: bold, size, color: INK });
        page.drawText(line, {
          x: MARGIN_X + labelWidth,
          y,
          font: regular,
          size,
          color: INK,
        });
      } else {
        page.drawText(line, { x: MARGIN_X, y, font: regular, size, color: INK });
      }
      y -= lineHeight;
    });
    y -= 2;
  };

  drawPageFrame();
  drawCentered(page, `OFÍCIO Nº ${oficioNumber(letter)}`, y, bold, 12.2);
  y -= 46;

  drawLabeled("Assunto", letter.subject);
  drawLabeled("Referência", letter.reference);
  y -= 22;

  drawParagraph(letter.recipient || "[DESTINATÁRIO]", { gapAfter: 2 });
  drawParagraph(letter.recipientRole, { gapAfter: 20 });
  drawParagraph(letter.salutation || "Prezado(a),", { indent: 68, gapAfter: 22 });

  const bodyParagraphs = safeText(letter.body || "[Redija aqui o conteúdo do ofício.]")
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim());
  bodyParagraphs.forEach((paragraph) =>
    drawParagraph(paragraph, { indent: 68, justify: true, gapAfter: 13 }),
  );
  drawParagraph(letter.closing, { indent: 68, justify: true, gapAfter: 17 });

  ensureSpace(assets.digitalSignature ? 138 : 112);
  drawRight(
    page,
    `Manacapuru - AM, ${longDate(letter.issueDate)}.`,
    y,
    regular,
    11.5,
  );

  if (assets.digitalSignature) {
    y -= 10;
    const boxWidth = 275;
    const boxHeight = 48;
    const boxX = (PAGE_WIDTH - boxWidth) / 2;
    const boxY = y - boxHeight;

    // Fundo e borda sutil clássicos do Adobe Acrobat / Foxit
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.99, 0.99, 0.99),
      borderColor: rgb(0.68, 0.68, 0.68),
      borderWidth: 0.6,
    });

    // Linha divisória vertical
    page.drawLine({
      start: { x: boxX + 105, y: boxY + 4 },
      end: { x: boxX + 105, y: boxY + boxHeight - 4 },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });

    // Lado esquerdo: Nome do signatário em destaque (Adobe / Foxit)
    const fullSigner = safeText(assets.digitalSignature.signerName || letter.signerName).trim().toUpperCase();
    const nameParts = fullSigner.split(" ");
    const mid = Math.ceil(nameParts.length / 2);
    const line1 = nameParts.slice(0, mid).join(" ");
    const line2 = nameParts.slice(mid).join(" ");

    let leftFontSize = 7.5;
    while (
      leftFontSize > 5.0 &&
      (helveticaBold.widthOfTextAtSize(line1, leftFontSize) > 92 ||
        (line2 && helveticaBold.widthOfTextAtSize(line2, leftFontSize) > 92))
    ) {
      leftFontSize -= 0.3;
    }

    if (line2) {
      page.drawText(line1, {
        x: boxX + 8,
        y: boxY + 26,
        size: leftFontSize,
        font: helveticaBold,
        color: rgb(0.12, 0.12, 0.12),
      });
      page.drawText(line2, {
        x: boxX + 8,
        y: boxY + 14,
        size: leftFontSize,
        font: helveticaBold,
        color: rgb(0.12, 0.12, 0.12),
      });
    } else {
      page.drawText(line1, {
        x: boxX + 8,
        y: boxY + 20,
        size: leftFontSize,
        font: helveticaBold,
        color: rgb(0.12, 0.12, 0.12),
      });
    }

    // Lado direito: Metadados oficiais padrão Adobe / Foxit
    const rightX = boxX + 112;
    page.drawText("Assinado de forma digital por", {
      x: rightX,
      y: boxY + 36,
      size: 6.2,
      font: helvetica,
      color: rgb(0.42, 0.42, 0.42),
    });

    let rightSignerFontSize = 6.8;
    while (
      rightSignerFontSize > 5.0 &&
      helveticaBold.widthOfTextAtSize(fullSigner, rightSignerFontSize) > 155
    ) {
      rightSignerFontSize -= 0.3;
    }

    page.drawText(fullSigner, {
      x: rightX,
      y: boxY + 26,
      size: rightSignerFontSize,
      font: helveticaBold,
      color: rgb(0.10, 0.10, 0.10),
    });

    const sigDate = assets.digitalSignature.date || new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(sigDate);
    const p: Record<string, string> = {};
    parts.forEach(({ type, value }) => {
      p[type] = value;
    });
    const dateStr = `Dados: ${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second} -04'00'`;

    page.drawText(dateStr, {
      x: rightX,
      y: boxY + 16,
      size: 6.2,
      font: helvetica,
      color: rgb(0.25, 0.25, 0.25),
    });

    const cpfPart = assets.digitalSignature.cpf
      ? `CPF: ***.${assets.digitalSignature.cpf.slice(3, 6)}.${assets.digitalSignature.cpf.slice(6, 9)}-** · `
      : "";
    page.drawText(`${cpfPart}ICP-Brasil · PAdES`, {
      x: rightX,
      y: boxY + 6,
      size: 5.6,
      font: helvetica,
      color: rgb(0.50, 0.50, 0.50),
    });

    y = boxY - 14;
  } else {
    y -= 63;
  }

  drawCentered(page, safeText(letter.signerName).toUpperCase(), y, bold, 10.8);
  y -= 15;
  drawCentered(page, safeText(letter.signerRole).toUpperCase(), y, regular, 10.5);

  return pdf.save();
}
