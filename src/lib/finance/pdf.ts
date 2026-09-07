import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

export const PDF_COLORS = {
  text: rgb(0.08, 0.1, 0.14),
  muted: rgb(0.38, 0.43, 0.5),
  border: rgb(0.82, 0.84, 0.87),
  header: rgb(0.95, 0.96, 0.97),
  white: rgb(1, 1, 1),
};

export async function createFinancePdf() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansBengali-Regular.ttf");
  const fontBytes = await readFile(fontPath);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  return { pdfDoc, font };
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return [""];
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

export function drawWrappedText(input: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  size?: number;
  lineHeight?: number;
  maxLines?: number;
}) {
  const size = input.size ?? 9;
  const lineHeight = input.lineHeight ?? size * 1.25;
  const lines = wrapText(input.text, input.font, size, input.maxWidth).slice(0, input.maxLines ?? 99);
  lines.forEach((line, index) => {
    input.page.drawText(line, {
      x: input.x,
      y: input.y - index * lineHeight,
      size,
      font: input.font,
      color: PDF_COLORS.text,
    });
  });
  return { lines, height: Math.max(lineHeight, lines.length * lineHeight) };
}

export function drawBusinessHeader(input: {
  page: PDFPage;
  font: PDFFont;
  title: string;
  subtitle?: string;
  pageWidth: number;
  topY: number;
  compact?: boolean;
}) {
  const left = 28;
  const top = input.topY;
  input.page.drawText("Trendy Deals BD", { x: left, y: top, size: input.compact ? 17 : 20, font: input.font, color: PDF_COLORS.text });
  input.page.drawText("01712969880", { x: left, y: top - 18, size: 9, font: input.font, color: PDF_COLORS.muted });
  input.page.drawText("Auth by Abdullah al sabbir", { x: left, y: top - 32, size: 9, font: input.font, color: PDF_COLORS.muted });

  const titleSize = input.compact ? 13 : 15;
  const titleWidth = input.font.widthOfTextAtSize(input.title, titleSize);
  input.page.drawText(input.title, { x: Math.max(left, input.pageWidth - left - titleWidth), y: top, size: titleSize, font: input.font, color: PDF_COLORS.text });
  if (input.subtitle) {
    const subWidth = input.font.widthOfTextAtSize(input.subtitle, 8.5);
    input.page.drawText(input.subtitle, { x: Math.max(left, input.pageWidth - left - subWidth), y: top - 18, size: 8.5, font: input.font, color: PDF_COLORS.muted });
  }

  input.page.drawLine({ start: { x: left, y: top - 45 }, end: { x: input.pageWidth - left, y: top - 45 }, thickness: 1, color: PDF_COLORS.border });
  return top - 60;
}

export function drawTableCell(input: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  yTop: number;
  width: number;
  height: number;
  size?: number;
  padding?: number;
  header?: boolean;
  align?: "left" | "right" | "center";
  maxLines?: number;
}) {
  const padding = input.padding ?? 4;
  const size = input.size ?? 8;
  if (input.header) {
    input.page.drawRectangle({ x: input.x, y: input.yTop - input.height, width: input.width, height: input.height, color: PDF_COLORS.header });
  }
  input.page.drawRectangle({ x: input.x, y: input.yTop - input.height, width: input.width, height: input.height, borderColor: PDF_COLORS.border, borderWidth: 0.6 });
  const maxWidth = input.width - padding * 2;
  const lines = wrapText(input.text, input.font, size, maxWidth).slice(0, input.maxLines ?? 2);
  const lineHeight = size * 1.2;
  lines.forEach((line, index) => {
    const textWidth = input.font.widthOfTextAtSize(line, size);
    let x = input.x + padding;
    if (input.align === "right") x = input.x + input.width - padding - textWidth;
    if (input.align === "center") x = input.x + (input.width - textWidth) / 2;
    input.page.drawText(line, {
      x: Math.max(input.x + padding, x),
      y: input.yTop - padding - size - index * lineHeight,
      size,
      font: input.font,
      color: PDF_COLORS.text,
    });
  });
}
