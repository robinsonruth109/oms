import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function getLocalDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { prisma } = await import("@/lib/prisma");

  const searchParams = request.nextUrl.searchParams;

  const today = getLocalDateInputValue();
  const from = (searchParams.get("from") || today).trim();
  const to = (searchParams.get("to") || today).trim();
  const agentId = (searchParams.get("agentId") || "").trim();

  const whereBase: Record<string, any> = {
    calledAt: {
      gte: startOfDay(from),
      lte: endOfDay(to),
    },
    calledByUserId: {
      not: null,
    },
  };

  if (agentId) {
    whereBase.calledByUserId = agentId;
  }

  const orders = await prisma.order.findMany({
    where: whereBase,
    include: {
      source: true,
      page: true,
      items: {
        orderBy: {
            createdAt: "asc",
        },
        include: {
            product: {
            include: {
                parent: true,
            },
            },
        },
        },
    },
    orderBy: {
      calledAt: "desc",
    },
  });

  const maxItems = Math.max(
    8,
    ...orders.map((order) => order.items.length)
  );

  const headers = [
    "Invoice ID",
    "Source Name",
    "Page Name",
    "Import Date",
    "Customer Name",
    "Phone Number",
    "Address",
  ];

  for (let i = 1; i <= maxItems; i += 1) {
    headers.push(
      `Product Parent Code-${i}`,
      `Product SKU-${i}`,
      `Product Price-${i}`,
      `QTY-${i}`
    );
  }

  headers.push(
    "DV Cost",
    "Advance",
    "Discount",
    "Grand Total",
    "Note",
    "Status"
  );

  const rows = orders.map((order) => {
    const row: unknown[] = [
      order.invoiceId || "",
      order.source?.name || "",
      order.page?.name || "",
      formatDate(order.createdAt),
      order.customerName || "",
      order.phone || "",
      order.address || "",
    ];

    for (let i = 0; i < maxItems; i += 1) {
      const item = order.items[i];

      row.push(
        item?.product?.parent?.sku || "",
        item?.productSku || "",
        item ? Number(item.unitPrice) : "",
        item?.quantity || ""
      );
    }

    function formatStatus(status: string) {
        switch (status) {
            case "READY_TO_SHIP":
            return "Ready";
            case "NO_ANSWER":
            return "No Answer";
            case "PHONE_OFF":
            return "Phone Off";
            case "STOCK_OUT":
            return "Stock Out";
            case "CANCELLED":
            return "Cancelled";
            case "PENDING_CONFIRMATION":
            return "Pending";
            default:
            return status;
        }
        }

        row.push(
            Number(order.deliveryCharge || 0),
            Number(order.advance || 0),
            Number(order.discount || 0),
            Number(order.totalAmount || 0),
            order.note || "",
            formatStatus(order.orderStatus)
            );

    return row;
  });

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="called-orders-${from}-to-${to}.csv"`,
    },
  });
}