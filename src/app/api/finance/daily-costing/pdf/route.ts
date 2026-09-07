import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { PageSizes } from "pdf-lib";

import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue, getBangladeshDayRange } from "@/lib/bangladesh-time";
import { createFinancePdf, drawBusinessHeader, drawTableCell, wrapText } from "@/lib/finance/pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

  const date = request.nextUrl.searchParams.get("date") || getBangladeshDateInputValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new NextResponse("Invalid date", { status: 400 });

  const range = getBangladeshDayRange(date);
  const costs = await prisma.financeDailyCost.findMany({
    where: { costDate: { gte: range.start, lte: range.end } },
    include: { createdByUser: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }],
  });

  const useA5 = costs.length <= 10;
  const pageSize: [number, number] = useA5 ? [419.53, 595.28] : [PageSizes.A4[0], PageSizes.A4[1]];
  const { pdfDoc, font } = await createFinancePdf();
  const [pageWidth, pageHeight] = pageSize;
  const margin = 28;
  const columns = useA5
    ? [24, 72, 171, 68, 47]
    : [30, 90, 245, 85, 89];
  const headers = ["SL", "Category", "Description", "Method", "Amount"];
  const baseRowHeight = useA5 ? 30 : 32;
  const headerHeight = 25;
  const bottomReserve = 62;

  let page = pdfDoc.addPage(pageSize);
  let y = drawBusinessHeader({ page, font, title: "Daily Cost Report", subtitle: `Date: ${dateLabel(date)}`, pageWidth, topY: pageHeight - 28, compact: useA5 });

  const drawHeaders = () => {
    let x = margin;
    headers.forEach((header, index) => {
      drawTableCell({ page, font, text: header, x, yTop: y, width: columns[index], height: headerHeight, size: useA5 ? 7.5 : 8, header: true, align: index === 0 ? "center" : index === 4 ? "right" : "left" });
      x += columns[index];
    });
    y -= headerHeight;
  };
  drawHeaders();

  costs.forEach((cost, index) => {
    const details = cost.note ? `${cost.description} | Note: ${cost.note}` : cost.description;
    const detailLines = wrapText(details, font, useA5 ? 7.3 : 8, columns[2] - 8);
    const rowHeight = Math.max(baseRowHeight, 10 + Math.min(detailLines.length, 4) * (useA5 ? 9 : 10));
    if (y - rowHeight < bottomReserve) {
      page = pdfDoc.addPage(pageSize);
      y = drawBusinessHeader({ page, font, title: "Daily Cost Report", subtitle: `${dateLabel(date)} - continued`, pageWidth, topY: pageHeight - 28, compact: useA5 });
      drawHeaders();
    }
    const values = [String(index + 1), cost.category, details, cost.paymentMethod || "-", money(cost.amount)];
    let x = margin;
    values.forEach((value, colIndex) => {
      drawTableCell({ page, font, text: value, x, yTop: y, width: columns[colIndex], height: rowHeight, size: useA5 ? 7.3 : 8, maxLines: colIndex === 2 ? 4 : 2, align: colIndex === 0 ? "center" : colIndex === 4 ? "right" : "left" });
      x += columns[colIndex];
    });
    y -= rowHeight;
  });

  if (y - 48 < 28) {
    page = pdfDoc.addPage(pageSize);
    y = drawBusinessHeader({ page, font, title: "Daily Cost Report", subtitle: dateLabel(date), pageWidth, topY: pageHeight - 28, compact: useA5 });
  }

  const total = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  page.drawText(`Total Entries: ${costs.length}`, { x: margin, y: y - 18, size: 9, font });
  const totalText = `Daily Total: ${money(total)}`;
  page.drawText(totalText, { x: pageWidth - margin - font.widthOfTextAtSize(totalText, 10), y: y - 18, size: 10, font });
  page.drawText("Prepared by: ____________________", { x: margin, y: 28, size: 8, font });
  const authText = "Authorized: Abdullah al sabbir";
  page.drawText(authText, { x: pageWidth - margin - font.widthOfTextAtSize(authText, 8), y: 28, size: 8, font });

  const bytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="daily-cost-${date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
