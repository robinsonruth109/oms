import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeDate(value: string | null, fallback: string) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");

  // Prevent customer/product supplied values from becoming spreadsheet formulas.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const today = getBangladeshDateInputValue();
  const filterDate = safeDate(request.nextUrl.searchParams.get("date"), today);
  const { prisma } = await import("@/lib/prisma");

  const logs = await prisma.pathaoReturnTrack.findMany({
    where: {
      processedAt: {
        gte: bangladeshDateStartUtc(filterDate),
        lte: bangladeshDateEndUtc(filterDate),
      },
    },
    include: {
      order: {
        select: {
          invoiceId: true,
          customerName: true,
          phone: true,
        },
      },
      pathaoCourier: {
        select: { name: true },
      },
      processedByUser: {
        select: { name: true, username: true },
      },
      items: {
        select: {
          productSkuSnapshot: true,
          productNameSnapshot: true,
          returnedQty: true,
        },
      },
    },
    orderBy: { processedAt: "desc" },
  });

  const headers = [
    "Invoice ID",
    "Return Consignment ID",
    "Outbound Consignment ID",
    "Courier",
    "Customer",
    "Phone",
    "Returned Items",
    "Return Type",
    "Previous OMS Status",
    "Current OMS Status",
    "Pathao Status",
    "Pathao Status Slug",
    "Qty Restored",
    "Agent",
    "Processed Date / Time (Bangladesh)",
  ];

  const rows = logs.map((log) => [
    log.order.invoiceId || log.merchantOrderId,
    log.returnConsignmentId,
    log.outboundConsignmentId || "",
    log.pathaoCourier.name,
    log.order.customerName,
    log.order.phone,
    log.items
      .map(
        (item) =>
          `${item.productSkuSnapshot} - ${item.productNameSnapshot} x ${item.returnedQty}`
      )
      .join(" | "),
    log.returnType,
    log.previousOmsStatus,
    log.newOmsStatus,
    log.pathaoOrderStatus || "",
    log.pathaoOrderStatusSlug || "",
    log.totalRestoredQty,
    log.processedByUser.name || log.processedByUser.username || "OMS User",
    formatBangladeshDateTime(log.processedAt),
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  // BOM makes Bangla customer/product text open correctly in Microsoft Excel.
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pathao-return-report-${filterDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
