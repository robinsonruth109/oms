import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function escapeCsv(value: string | number) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function keepAsText(value: string) {
  return `="${String(value || "")}"`;
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

  const rows = [
    [
      "Merchant order id",
      "Name",
      "Contact No.",
      "Customer Address",
      "District",
      "Price",
      "Instruction",
    ],
    ...batch.items.map((batchItem) => {
      const order = batchItem.order;

      return [
        keepAsText(order.invoiceId),
        order.customerName,
        keepAsText(order.phone),
        order.address,
        "",
        Number(order.totalAmount).toFixed(2),
        order.note || "",
      ];
    }),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${batch.batchNo}.csv"`,
    },
  });
}