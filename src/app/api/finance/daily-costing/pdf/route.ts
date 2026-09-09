import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { PageSizes, type PDFPage } from "pdf-lib";

import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue, getBangladeshDayRange } from "@/lib/bangladesh-time";
import { calculateDailyCashBook, DAILY_PAYMENT_METHODS } from "@/lib/finance/daily-cash";
import { createFinancePdf, drawBusinessHeader, drawTableCell, wrapText } from "@/lib/finance/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(value: unknown) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  return `${sign}Tk ${Math.abs(amount).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

  // Lazy-load Prisma at request time so Railway/Next build never initializes
  // the MariaDB adapter while collecting route configuration.
  const { prisma } = await import("@/lib/prisma");

  const date = request.nextUrl.searchParams.get("date") || getBangladeshDateInputValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new NextResponse("Invalid date", { status: 400 });

  const range = getBangladeshDayRange(date);
  const [entries, priorEntries] = await Promise.all([
    prisma.financeDailyCost.findMany({
      where: { costDate: { gte: range.start, lte: range.end } },
      include: { createdByUser: { select: { name: true } } },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.financeDailyCost.findMany({
      where: { costDate: { lt: range.start } },
      select: { entryType: true, amount: true, paymentMethod: true },
      orderBy: [{ costDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const jomaEntries = entries.filter((entry) => entry.entryType === "JOMA");
  const khorochEntries = entries.filter((entry) => entry.entryType !== "JOMA");
  const totals = calculateDailyCashBook(priorEntries, entries);

  const maxDetailLength = entries.reduce((max, entry) => Math.max(max, String(entry.note || entry.description || "").length), 0);
  const useA5 = entries.length <= 6 && maxDetailLength <= 85;
  const pageSize: [number, number] = useA5 ? [419.53, 595.28] : [PageSizes.A4[0], PageSizes.A4[1]];
  const { pdfDoc, font } = await createFinancePdf();
  const [pageWidth, pageHeight] = pageSize;
  const margin = 28;
  const bottomReserve = 46;
  const normalSize = useA5 ? 7.2 : 8;
  const sectionSize = useA5 ? 9.5 : 11;

  let page: PDFPage = pdfDoc.addPage(pageSize);
  let y = drawBusinessHeader({
    page,
    font,
    title: "Daily Cash Book",
    subtitle: `Date: ${dateLabel(date)}`,
    pageWidth,
    topY: pageHeight - 28,
    compact: useA5,
  });

  const addPage = (continued = true) => {
    page = pdfDoc.addPage(pageSize);
    y = drawBusinessHeader({
      page,
      font,
      title: "Daily Cash Book",
      subtitle: continued ? `${dateLabel(date)} - continued` : `Date: ${dateLabel(date)}`,
      pageWidth,
      topY: pageHeight - 28,
      compact: useA5,
    });
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottomReserve) addPage(true);
  };

  const drawLabelValue = (label: string, value: string, yPos: number, right = false) => {
    const size = useA5 ? 8.2 : 9.5;
    const text = `${label}: ${value}`;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: right ? pageWidth - margin - width : margin,
      y: yPos,
      size,
      font,
    });
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(25);
    page.drawText(title, { x: margin, y: y - 2, size: sectionSize, font });
    y -= useA5 ? 18 : 21;
  };

  const drawJomaTable = () => {
    drawSectionTitle("Today Cash In / Joma");
    if (!jomaEntries.length) {
      page.drawText("No Joma entries.", { x: margin, y: y - 8, size: normalSize, font });
      y -= 24;
      return;
    }

    const columns = useA5 ? [22, 180, 70, 91] : [28, 285, 90, 136];
    const headers = ["SL", "Details / Note", "Method", "Amount"];
    const headerHeight = 23;

    const drawHeaders = () => {
      let x = margin;
      headers.forEach((header, index) => {
        drawTableCell({ page, font, text: header, x, yTop: y, width: columns[index], height: headerHeight, size: normalSize, header: true, align: index === 0 ? "center" : index === 3 ? "right" : "left" });
        x += columns[index];
      });
      y -= headerHeight;
    };

    drawHeaders();
    jomaEntries.forEach((entry, index) => {
      const details = entry.note || entry.description || "Cash In";
      const lineCount = Math.min(wrapText(details, font, normalSize, columns[1] - 8).length, 4);
      const rowHeight = Math.max(useA5 ? 27 : 29, 10 + lineCount * (useA5 ? 8.8 : 9.6));
      if (y - rowHeight < bottomReserve) {
        addPage(true);
        drawSectionTitle("Today Cash In / Joma - continued");
        drawHeaders();
      }
      const values = [String(index + 1), details, entry.paymentMethod || "-", money(entry.amount)];
      let x = margin;
      values.forEach((value, colIndex) => {
        drawTableCell({ page, font, text: value, x, yTop: y, width: columns[colIndex], height: rowHeight, size: normalSize, maxLines: colIndex === 1 ? 4 : 2, align: colIndex === 0 ? "center" : colIndex === 3 ? "right" : "left" });
        x += columns[colIndex];
      });
      y -= rowHeight;
    });
    ensureSpace(24);
    const text = `Total Joma: ${money(totals.totalJoma)}`;
    page.drawText(text, { x: pageWidth - margin - font.widthOfTextAtSize(text, normalSize + 1), y: y - 12, size: normalSize + 1, font });
    y -= 28;
  };

  const drawKhorochTable = () => {
    drawSectionTitle("Khoroch List");
    if (!khorochEntries.length) {
      page.drawText("No Khoroch entries.", { x: margin, y: y - 8, size: normalSize, font });
      y -= 24;
      return;
    }

    const columns = useA5 ? [22, 78, 125, 65, 73] : [28, 110, 220, 80, 101];
    const headers = ["SL", "Expense Type", "Note / Details", "Method", "Amount"];
    const headerHeight = 23;

    const drawHeaders = () => {
      let x = margin;
      headers.forEach((header, index) => {
        drawTableCell({ page, font, text: header, x, yTop: y, width: columns[index], height: headerHeight, size: normalSize, header: true, align: index === 0 ? "center" : index === 4 ? "right" : "left" });
        x += columns[index];
      });
      y -= headerHeight;
    };

    drawHeaders();
    khorochEntries.forEach((entry, index) => {
      const details = entry.note || entry.description || "-";
      const typeLines = Math.min(wrapText(entry.category, font, normalSize, columns[1] - 8).length, 3);
      const detailLines = Math.min(wrapText(details, font, normalSize, columns[2] - 8).length, 4);
      const lineCount = Math.max(typeLines, detailLines);
      const rowHeight = Math.max(useA5 ? 29 : 31, 10 + lineCount * (useA5 ? 8.8 : 9.6));
      if (y - rowHeight < bottomReserve) {
        addPage(true);
        drawSectionTitle("Khoroch List - continued");
        drawHeaders();
      }
      const values = [String(index + 1), entry.category, details, entry.paymentMethod || "-", money(entry.amount)];
      let x = margin;
      values.forEach((value, colIndex) => {
        drawTableCell({ page, font, text: value, x, yTop: y, width: columns[colIndex], height: rowHeight, size: normalSize, maxLines: colIndex === 1 ? 3 : colIndex === 2 ? 4 : 2, align: colIndex === 0 ? "center" : colIndex === 4 ? "right" : "left" });
        x += columns[colIndex];
      });
      y -= rowHeight;
    });
    ensureSpace(24);
    const text = `Total Khoroch: ${money(totals.totalKhoroch)}`;
    page.drawText(text, { x: pageWidth - margin - font.widthOfTextAtSize(text, normalSize + 1), y: y - 12, size: normalSize + 1, font });
    y -= 28;
  };

  ensureSpace(useA5 ? 74 : 82);
  drawLabelValue("Existing Balance", money(totals.openingBalance), y - 3);
  drawLabelValue("Today Cash In", money(totals.totalJoma), y - 3, true);
  drawLabelValue("Today Khoroch", money(totals.totalKhoroch), y - (useA5 ? 20 : 23));
  drawLabelValue("Today Lasting Balance", money(totals.closingBalance), y - (useA5 ? 20 : 23), true);
  y -= useA5 ? 47 : 54;

  drawJomaTable();
  drawKhorochTable();

  ensureSpace(useA5 ? 92 : 105);
  drawSectionTitle("Closing Balance by Method");
  const visibleMethods = Object.keys(totals.byMethod).filter((method) => {
    const balance = totals.byMethod[method];
    return balance.opening !== 0 || balance.joma !== 0 || balance.khoroch !== 0 || balance.closing !== 0;
  });
  const methodList = visibleMethods.length ? visibleMethods : [...DAILY_PAYMENT_METHODS];
  methodList.forEach((method) => {
    const balance = totals.byMethod[method];
    const line = `${method}: Opening ${money(balance.opening)}   + Joma ${money(balance.joma)}   - Khoroch ${money(balance.khoroch)}   = ${money(balance.closing)}`;
    const lines = wrapText(line, font, normalSize, pageWidth - margin * 2);
    lines.slice(0, 2).forEach((text, index) => {
      page.drawText(text, { x: margin, y: y - index * (normalSize + 3), size: normalSize, font });
    });
    y -= Math.max(17, lines.slice(0, 2).length * (normalSize + 3) + 4);
  });

  ensureSpace(40);
  const finalText = `TODAY LASTING BALANCE: ${money(totals.closingBalance)}`;
  page.drawText(finalText, { x: margin, y: y - 5, size: useA5 ? 10.5 : 12, font });

  // Footer on every page.
  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText("Prepared by: ____________________", { x: margin, y: 24, size: 7.8, font });
    const authText = "Authorized: Abdullah al sabbir";
    pdfPage.drawText(authText, { x: pageWidth - margin - font.widthOfTextAtSize(authText, 7.8), y: 24, size: 7.8, font });
    if (pages.length > 1) {
      const pageText = `Page ${index + 1} of ${pages.length}`;
      pdfPage.drawText(pageText, { x: (pageWidth - font.widthOfTextAtSize(pageText, 7)) / 2, y: 24, size: 7, font });
    }
  });

  const bytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="daily-cash-book-${date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
