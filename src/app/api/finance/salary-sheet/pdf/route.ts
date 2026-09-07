import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { PageSizes } from "pdf-lib";

import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { createFinancePdf, drawBusinessHeader, drawTableCell } from "@/lib/finance/pdf";
import { calculateSalaryTotals, ensureSalaryMonth, normalizeSalaryMonth } from "@/lib/finance/salary";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(value: unknown) {
  return Number(value || 0).toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

  let month: string;
  try {
    month = normalizeSalaryMonth(request.nextUrl.searchParams.get("month") || getBangladeshDateInputValue().slice(0, 7));
  } catch {
    return new NextResponse("Invalid month", { status: 400 });
  }

  const profiles = await prisma.salaryProfile.findMany({
    where: { enabled: true },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const rows = [] as Array<{
    name: string;
    username: string;
    base: number;
    increment: number;
    bonus: number;
    advance: number;
    liability: number;
    fine: number;
    netPayable: number;
  }>;

  for (const profile of profiles) {
    const salaryMonth = await ensureSalaryMonth(profile.userId, month);
    const refreshed = await prisma.salaryMonth.findUnique({
      where: { id: salaryMonth.id },
      include: { transactions: true },
    });
    if (!refreshed) continue;
    const totals = calculateSalaryTotals({
      baseSalary: refreshed.baseSalary,
      incrementAmount: refreshed.incrementAmount,
      transactions: refreshed.transactions,
    });
    rows.push({
      name: profile.user.name,
      username: profile.user.username,
      base: totals.baseSalary,
      increment: totals.increment,
      bonus: totals.bonus,
      advance: totals.advance,
      liability: totals.liabilityBalance,
      fine: totals.fine,
      netPayable: totals.totalOutstanding,
    });
  }

  const { pdfDoc, font } = await createFinancePdf();
  const pageWidth = PageSizes.A4[1];
  const pageHeight = PageSizes.A4[0];
  const pageSize: [number, number] = [pageWidth, pageHeight];
  const margin = 24;
  const headers = ["SL", "Agent Name", "Base Salary", "Increment", "Bonus", "Advance", "Liabilities", "Fines", "Net Payable", "Signature"];
  const widths = [28, 142, 76, 70, 62, 68, 74, 58, 78, 137];
  const headerHeight = 30;
  const rowHeight = 32;
  const bottomReserve = 44;

  let page = pdfDoc.addPage(pageSize);
  let y = drawBusinessHeader({ page, font, title: "Monthly Salary Sheet", subtitle: monthLabel(month), pageWidth, topY: pageHeight - 24 });

  const drawHeaders = () => {
    let x = margin;
    headers.forEach((header, index) => {
      drawTableCell({ page, font, text: header, x, yTop: y, width: widths[index], height: headerHeight, size: 8, header: true, align: index === 0 ? "center" : index >= 2 && index <= 8 ? "right" : "left" });
      x += widths[index];
    });
    y -= headerHeight;
  };
  drawHeaders();

  rows.forEach((row, index) => {
    if (y - rowHeight < bottomReserve) {
      page = pdfDoc.addPage(pageSize);
      y = drawBusinessHeader({ page, font, title: "Monthly Salary Sheet", subtitle: `${monthLabel(month)} - continued`, pageWidth, topY: pageHeight - 24 });
      drawHeaders();
    }

    const values = [
      String(index + 1),
      `${row.name}\n@${row.username}`,
      money(row.base),
      money(row.increment),
      money(row.bonus),
      money(row.advance),
      money(row.liability),
      money(row.fine),
      money(row.netPayable),
      "",
    ];

    let x = margin;
    values.forEach((value, colIndex) => {
      drawTableCell({ page, font, text: value.replace("\n", " "), x, yTop: y, width: widths[colIndex], height: rowHeight, size: 7.8, align: colIndex === 0 ? "center" : colIndex >= 2 && colIndex <= 8 ? "right" : "left" });
      x += widths[colIndex];
    });
    y -= rowHeight;
  });

  if (rows.length === 0) {
    page.drawText("No agents have an active salary profile.", { x: margin, y: y - 30, size: 11, font });
  }

  const totalPayable = rows.reduce((sum, row) => sum + row.netPayable, 0);
  const footerText = `Agents: ${rows.length}    Total Net Payable: Tk ${money(totalPayable)}`;
  page.drawText(footerText, { x: margin, y: 24, size: 8.5, font });
  const authText = "Authorized by Abdullah al sabbir";
  page.drawText(authText, { x: pageWidth - margin - font.widthOfTextAtSize(authText, 8.5), y: 24, size: 8.5, font });

  const bytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="salary-sheet-${month}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
