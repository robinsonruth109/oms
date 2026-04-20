import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function keepAsText(value: string) {
  return `="${String(value || "").replace(/"/g, '""')}"`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;

  const batch = await prisma.csvBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      items: {
        include: {
          order: true,
        },
      },
    },
  });

  if (!batch) {
    return new Response("CSV batch not found", { status: 404 });
  }

  const headers = [
    "Invoice ID",
    "Customer Name",
    "Phone",
    "Address",
    "Courier",
    "Total Amount",
    "Ready To Ship Date",
  ];

  const rows = batch.items.map((item: (typeof batch.items)[number]) => {
    const order = item.order;

    return [
      keepAsText(order.invoiceId || ""),
      order.customerName || "",
      keepAsText(order.phone || ""),
      (order.address || "").replace(/\r?\n/g, " "),
      order.courier || "",
      String(Number(order.totalAmount || 0)),
      order.readyToShipAt
        ? new Date(order.readyToShipAt).toISOString().slice(0, 10)
        : "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n")
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${batch.batchNo}.csv"`,
    },
  });
}