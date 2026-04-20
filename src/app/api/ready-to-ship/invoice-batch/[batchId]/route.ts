import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type OrderForPdf = {
  invoiceId: string;
  customerName: string;
  phone: string;
  address: string;
  courier: string;
  discount: number;
  advance: number;
  deliveryCharge: number;
  totalAmount: number;
  createdAt: Date;
  pageName: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  note: string;
};

const RETURN_NOTICE_EN =
  "Note: If product is returned, it must be returned in intact condition. Packet must not be opened, as this is not a dress.";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function safeAscii(text: string) {
  return String(text || "").replace(/[^\x20-\x7E]/g, " ");
}

function hasUnicode(text: string) {
  return /[^\x00-\x7F]/.test(String(text || ""));
}

function drawText(
  page: any,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  color = rgb(0, 0, 0)
) {
  page.drawText(String(text || ""), {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawLine(page: any, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
}

function drawRect(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
}

function barcodeBits(input: string) {
  const chars = `*${input.toUpperCase()}*`;
  const patterns: Record<string, string> = {
    "0": "101001101101",
    "1": "110100101011",
    "2": "101100101011",
    "3": "110110010101",
    "4": "101001101011",
    "5": "110100110101",
    "6": "101100110101",
    "7": "101001011011",
    "8": "110100101101",
    "9": "101100101101",
    A: "110101001011",
    B: "101101001011",
    C: "110110100101",
    D: "101011001011",
    E: "110101100101",
    F: "101101100101",
    G: "101010011011",
    H: "110101001101",
    I: "101101001101",
    J: "101011001101",
    K: "110101010011",
    L: "101101010011",
    M: "110110101001",
    N: "101011010011",
    O: "110101101001",
    P: "101101101001",
    Q: "101010110011",
    R: "110101011001",
    S: "101101011001",
    T: "101011011001",
    U: "110010101011",
    V: "100110101011",
    W: "110011010101",
    X: "100101101011",
    Y: "110010110101",
    Z: "100110110101",
    "-": "100101011011",
    ".": "110010101101",
    " ": "100110101101",
    "$": "100100100101",
    "/": "100100101001",
    "+": "100101001001",
    "%": "101001001001",
    "*": "100101101101",
  };

  const chunks: string[] = [];

  for (const ch of chars) {
    if (patterns[ch]) {
      chunks.push(patterns[ch]);
      chunks.push("0");
    }
  }

  return chunks.join("");
}

function drawBarcode(
  page: any,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const printableValue = safeAscii(value).toUpperCase();
  const bits = barcodeBits(printableValue);
  if (!bits) return;

  const barWidth = width / bits.length;

  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === "1") {
      page.drawRectangle({
        x: x + i * barWidth,
        y,
        width: Math.max(barWidth, 0.7),
        height,
        color: rgb(0, 0, 0),
      });
    }
  }
}

function fitSingleLine(text: string, maxWidth: number, font: any, size: number) {
  const clean = safeAscii(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
    return clean;
  }

  let result = clean;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return result ? `${result}...` : "";
}

function fitSingleLineUnicode(text: string, maxWidth: number, font: any, size: number) {
  const clean = String(text || "").trim();
  if (!clean) return "";

  if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
    return clean;
  }

  let result = clean;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return result ? `${result}...` : "";
}

function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  size: number,
  font: any,
  maxLines = 2
) {
  const words = safeAscii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const nextWidth = font.widthOfTextAtSize(next, size);

    if (nextWidth <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);

  lines.forEach((line, index) => {
    drawText(page, line, x, y - index * lineHeight, size, font);
  });
}

function getInvoiceMode(order: OrderForPdf) {
  return order.items.length > 10 ? "full" : "half";
}

function drawInvoiceBox(
  page: any,
  order: OrderForPdf,
  topY: number,
  boxHeight: number,
  regularFont: any,
  boldFont: any,
  banglaFont: any | null,
  banglaNoteImage: any | null
) {
  const left = 30;
  const usableWidth = 535;
  const isHalf = boxHeight <= 400;

  const title = safeAscii(order.pageName || "Invoice");

  drawText(page, title, 215, topY - 8, 16, boldFont);
  drawText(page, "Mirpur, Dhaka (01303559063)", 208, topY - 28, 8, regularFont);

  drawText(page, "Date :", left, topY - 48, 9, boldFont);
  drawText(page, formatDate(order.createdAt), left + 48, topY - 48, 9, boldFont);

  drawText(page, "Phone:", 455, topY - 48, 9, boldFont);
  drawText(page, order.phone, 500, topY - 48, 9, boldFont);

  drawText(page, "Invoice Code :", left, topY - 68, 10, boldFont);
  drawText(page, order.invoiceId, left + 104, topY - 68, 12, boldFont);

  drawText(page, "Name:", left, topY - 90, 10, boldFont);
  drawText(page, safeAscii(order.customerName), left + 104, topY - 90, 10, boldFont);

  drawText(page, "Address:", left, topY - 112, 10, boldFont);
  drawRect(page, left + 100, topY - 122, 425, 24);
  drawWrappedText(
    page,
    order.address,
    left + 106,
    topY - 114,
    413,
    10,
    9,
    regularFont,
    2
  );

  drawBarcode(page, order.invoiceId, 410, topY - 90, 110, 18);

  const tableTop = topY - 145;
  const tableLeft = left;
  const tableWidth = usableWidth;
  const headerHeight = 28;
  const bodyRows = isHalf ? 5 : 12;
  const rowHeight = isHalf ? 18 : 20;
  const tableHeight = headerHeight + rowHeight * bodyRows;

  const priceX = tableLeft + 372;
  const qtyX = tableLeft + 436;
  const totalX = tableLeft + 470;

  drawRect(page, tableLeft, tableTop - tableHeight, tableWidth, tableHeight);
  drawLine(page, tableLeft, tableTop - headerHeight, tableLeft + tableWidth, tableTop - headerHeight);
  drawLine(page, priceX, tableTop, priceX, tableTop - tableHeight);
  drawLine(page, qtyX, tableTop, qtyX, tableTop - tableHeight);
  drawLine(page, totalX, tableTop, totalX, tableTop - tableHeight);

  for (let i = 1; i <= bodyRows; i += 1) {
    drawLine(
      page,
      tableLeft,
      tableTop - headerHeight - rowHeight * i,
      tableLeft + tableWidth,
      tableTop - headerHeight - rowHeight * i
    );
  }

  drawText(page, "Product Name", tableLeft + 150, tableTop - 18, 9, boldFont);
  drawText(page, "Price", priceX + 18, tableTop - 18, 9, boldFont);
  drawText(page, "QTY", qtyX + 10, tableTop - 18, 9, boldFont);
  drawText(page, "Total", totalX + 12, tableTop - 18, 9, boldFont);

  order.items.slice(0, bodyRows).forEach((item, index) => {
    const rowTop = tableTop - headerHeight - rowHeight * index;
    const textY = rowTop - rowHeight + 5;

    const productFont = banglaFont && hasUnicode(item.productName) ? banglaFont : regularFont;
    const productName =
      productFont === banglaFont
        ? fitSingleLineUnicode(item.productName, 355, productFont, 8)
        : fitSingleLine(item.productName, 355, productFont, 8);

    drawText(page, productName, tableLeft + 6, textY, 8, productFont);
    drawText(page, String(item.unitPrice.toFixed(0)), priceX + 18, textY, 8, regularFont);
    drawText(page, String(item.quantity), qtyX + 12, textY, 8, regularFont);
    drawText(page, String(item.lineTotal.toFixed(0)), totalX + 10, textY, 8, regularFont);
  });

  const footerTop = tableTop - tableHeight - 26;

  drawText(page, "Delivery Cost=", left + 10, footerTop, 9, boldFont);
  drawText(page, String(order.deliveryCharge.toFixed(0)), left + 112, footerTop, 9, regularFont);

  drawText(page, "Advance =", 410, footerTop, 9, boldFont);
  drawText(page, String(order.advance.toFixed(0)), 487, footerTop, 9, regularFont);

  drawText(page, "Discount=", left + 14, footerTop - 20, 9, boldFont);
  drawText(page, String(order.discount.toFixed(0)), left + 112, footerTop - 20, 9, regularFont);

  drawText(page, "Grand Total=", 410, footerTop - 20, 9, boldFont);
  drawText(page, String(order.totalAmount.toFixed(0)), 487, footerTop - 20, 9, regularFont);

  drawText(page, "Note :", left + 14, footerTop - 44, 10, boldFont);

  if (banglaNoteImage) {
    page.drawImage(banglaNoteImage, {
      x: left + 56,
      y: footerTop - 50,
      width: 390,
      height: 26,
    });
  } else {
    drawWrappedText(
      page,
      RETURN_NOTICE_EN,
      left + 56,
      footerTop - 42,
      usableWidth - 70,
      10,
      7.5,
      regularFont,
      2
    );
  }

  drawLine(page, left, topY - boxHeight, left + usableWidth, topY - boxHeight);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;

  const batch = await prisma.invoiceBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      items: {
        include: {
          order: {
            include: {
              page: true,
              items: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return new Response("Invoice batch not found", { status: 404 });
  }

const orders: OrderForPdf[] = batch.items.map((item) => ({
  invoiceId: item.order.invoiceId || "",
  customerName: item.order.customerName || "",
  phone: item.order.phone || "",
  address: item.order.address || "",
  courier: item.order.courier || "",
  discount: Number(item.order.discount),
  advance: Number(item.order.advance),
  deliveryCharge: Number(item.order.deliveryCharge),
  totalAmount: Number(item.order.totalAmount),
  createdAt: item.order.createdAt,
  pageName: item.order.page?.name || "Invoice",
  note: item.order.note || "",
  items: item.order.items.map((orderItem) => ({
    productName: orderItem.productName || "",
    quantity: orderItem.quantity,
    unitPrice: Number(orderItem.unitPrice),
    lineTotal: Number(orderItem.lineTotal),
  })),
}));

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let banglaFont: any | null = null;

  try {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansBengali-Regular.ttf"
    );
    const fontBytes = fs.readFileSync(fontPath);
    banglaFont = await pdfDoc.embedFont(fontBytes);
  } catch {
    banglaFont = null;
  }

  let banglaNoteImage: any | null = null;

  try {
    const noteImagePath = path.join(process.cwd(), "public", "invoice-note-bn.png");
    if (fs.existsSync(noteImagePath)) {
      const noteImageBytes = fs.readFileSync(noteImagePath);
      banglaNoteImage = await pdfDoc.embedPng(noteImageBytes);
    }
  } catch {
    banglaNoteImage = null;
  }

  let i = 0;

  while (i < orders.length) {
    const current = orders[i];
    const currentMode = getInvoiceMode(current);

    if (currentMode === "full") {
      const page = pdfDoc.addPage([595.28, 841.89]);
      drawInvoiceBox(
        page,
        current,
        810,
        760,
        regularFont,
        boldFont,
        banglaFont,
        banglaNoteImage
      );
      i += 1;
      continue;
    }

    const next = orders[i + 1];
    const nextMode = next ? getInvoiceMode(next) : null;

    const page = pdfDoc.addPage([595.28, 841.89]);

    drawInvoiceBox(
      page,
      current,
      810,
      380,
      regularFont,
      boldFont,
      banglaFont,
      banglaNoteImage
    );

    if (next && nextMode === "half") {
      drawInvoiceBox(
        page,
        next,
        395,
        380,
        regularFont,
        boldFont,
        banglaFont,
        banglaNoteImage
      );
      i += 2;
    } else {
      i += 1;
    }
  }

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.batchNo}.pdf"`,
    },
  });
}