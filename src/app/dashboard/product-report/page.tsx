import { prisma } from "@/lib/prisma";
import ProductReportClient from "./report-client";

type ProductReportPageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    q?: string;
  }>;
};

function getLocalDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

type ProductReportRow = {
  sku: string;
  invoiceQty: number;
  totalQty: number;
  called: number;
  ready: number;
  noAnswer: number;
  phoneOff: number;
  stockOut: number;
  cancelled: number;
  pending: number;
  conversion: string;
};

export default async function ProductReportPage({
  searchParams,
}: ProductReportPageProps) {
  const params = (await searchParams) || {};

  const today = getLocalDateInputValue();
  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const q = (params.q || "").trim().toLowerCase();

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: {
          gte: startOfDay(from),
          lte: endOfDay(to),
        },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderStatus: true,
          calledAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const map = new Map<
    string,
    {
      sku: string;
      invoiceOrderIds: Set<string>;
      totalQty: number;
      calledOrderIds: Set<string>;
      readyOrderIds: Set<string>;
      noAnswerOrderIds: Set<string>;
      phoneOffOrderIds: Set<string>;
      stockOutOrderIds: Set<string>;
      cancelledOrderIds: Set<string>;
      pendingOrderIds: Set<string>;
    }
  >();

  for (const item of items) {
    const sku = String(item.productSku || "").trim() || "N/A";

    if (q && !sku.toLowerCase().includes(q)) {
      continue;
    }

    if (!map.has(sku)) {
      map.set(sku, {
        sku,
        invoiceOrderIds: new Set<string>(),
        totalQty: 0,
        calledOrderIds: new Set<string>(),
        readyOrderIds: new Set<string>(),
        noAnswerOrderIds: new Set<string>(),
        phoneOffOrderIds: new Set<string>(),
        stockOutOrderIds: new Set<string>(),
        cancelledOrderIds: new Set<string>(),
        pendingOrderIds: new Set<string>(),
      });
    }

    const row = map.get(sku)!;
    const orderId = item.order.id;

    row.invoiceOrderIds.add(orderId);
    row.totalQty += item.quantity;

    if (item.order.calledAt) {
      row.calledOrderIds.add(orderId);
    }

    switch (item.order.orderStatus) {
      case "READY_TO_SHIP":
        row.readyOrderIds.add(orderId);
        break;
      case "NO_ANSWER":
        row.noAnswerOrderIds.add(orderId);
        break;
      case "PHONE_OFF":
        row.phoneOffOrderIds.add(orderId);
        break;
      case "STOCK_OUT":
        row.stockOutOrderIds.add(orderId);
        break;
      case "CANCELLED":
        row.cancelledOrderIds.add(orderId);
        break;
      case "PENDING_CONFIRMATION":
        row.pendingOrderIds.add(orderId);
        break;
      default:
        break;
    }
  }

  const data: ProductReportRow[] = Array.from(map.values())
    .map((row) => {
      const invoiceQty = row.invoiceOrderIds.size;
      const called = row.calledOrderIds.size;
      const ready = row.readyOrderIds.size;
      const noAnswer = row.noAnswerOrderIds.size;
      const phoneOff = row.phoneOffOrderIds.size;
      const stockOut = row.stockOutOrderIds.size;
      const cancelled = row.cancelledOrderIds.size;
      const pending = row.pendingOrderIds.size;

      return {
        sku: row.sku,
        invoiceQty,
        totalQty: row.totalQty,
        called,
        ready,
        noAnswer,
        phoneOff,
        stockOut,
        cancelled,
        pending,
        conversion: called > 0 ? ((ready / called) * 100).toFixed(1) : "0.0",
      };
    })
    .sort((a, b) => b.invoiceQty - a.invoiceQty || b.totalQty - a.totalQty);

  return (
    <ProductReportClient
      data={data}
      filters={{
        from,
        to,
        q: params.q || "",
      }}
    />
  );
}