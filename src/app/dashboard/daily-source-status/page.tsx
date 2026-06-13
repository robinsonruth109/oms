export const dynamic = "force-dynamic";
export const revalidate = 0;

import DailySourceStatusClient from "./daily-source-status-client";

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    sourceId?: string;
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

type StatusBucket = {
  totalInvoice: number;
  ready: number;
  phoneOff: number;
  noAnswer: number;
  cancel: number;
  pending: number;
  stockOut: number;
  orderIds: Set<string>;
};

function emptyBucket(): StatusBucket {
  return {
    totalInvoice: 0,
    ready: 0,
    phoneOff: 0,
    noAnswer: 0,
    cancel: 0,
    pending: 0,
    stockOut: 0,
    orderIds: new Set<string>(),
  };
}

function applyStatus(bucket: StatusBucket, status: string, orderId: string) {
  if (bucket.orderIds.has(orderId)) return;

  bucket.orderIds.add(orderId);
  bucket.totalInvoice += 1;

  switch (status) {
    case "READY_TO_SHIP":
      bucket.ready += 1;
      break;
    case "PHONE_OFF":
      bucket.phoneOff += 1;
      break;
    case "NO_ANSWER":
      bucket.noAnswer += 1;
      break;
    case "CANCELLED":
      bucket.cancel += 1;
      break;
    case "PENDING_CONFIRMATION":
      bucket.pending += 1;
      break;
    case "STOCK_OUT":
      bucket.stockOut += 1;
      break;
    default:
      break;
  }
}

function toSafeBucket(bucket: StatusBucket) {
  return {
    totalInvoice: bucket.totalInvoice,
    ready: bucket.ready,
    phoneOff: bucket.phoneOff,
    noAnswer: bucket.noAnswer,
    cancel: bucket.cancel,
    pending: bucket.pending,
    stockOut: bucket.stockOut,
  };
}

export default async function DailySourceStatusPage({
  searchParams,
}: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const today = getLocalDateInputValue();

  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const sourceId = (params.sourceId || "").trim();

  const sources = await prisma.orderSource.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  const where: Record<string, any> = {
    createdAt: {
      gte: startOfDay(from),
      lte: endOfDay(to),
    },
  };

  if (sourceId) {
    where.sourceId = sourceId;
  }

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: where,
    },
    include: {
      order: {
        select: {
          id: true,
          orderStatus: true,
          source: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
      product: {
        include: {
          parent: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const parentMap = new Map<
    string,
    {
      parentCode: string;
      parentName: string;
      sourceName: string;
      skuRows: Map<
        string,
        {
          sku: string;
          productName: string;
        } & StatusBucket
      >;
    } & StatusBucket
  >();

  const totals = emptyBucket();

  for (const item of orderItems) {
    applyStatus(totals, item.order.orderStatus, item.order.id);

    const parentCode = item.product?.parent?.sku || "N/A";
    const parentName = item.product?.parent?.name || "No Parent";
    const sourceName = item.order.source.name;
    const key = `${sourceName}__${parentCode}`;

    if (!parentMap.has(key)) {
      parentMap.set(key, {
        parentCode,
        parentName,
        sourceName,
        skuRows: new Map(),
        ...emptyBucket(),
      });
    }

    const parentRow = parentMap.get(key)!;
    applyStatus(parentRow, item.order.orderStatus, item.order.id);

    const sku = item.productSku || "N/A";

    if (!parentRow.skuRows.has(sku)) {
      parentRow.skuRows.set(sku, {
        sku,
        productName: item.productName || "",
        ...emptyBucket(),
      });
    }

    applyStatus(
      parentRow.skuRows.get(sku)!,
      item.order.orderStatus,
      item.order.id
    );
  }

  const rows = Array.from(parentMap.values())
    .map((row) => ({
      parentCode: row.parentCode,
      parentName: row.parentName,
      sourceName: row.sourceName,
      ...toSafeBucket(row),
      skuRows: Array.from(row.skuRows.values())
        .map((sku) => ({
          sku: sku.sku,
          productName: sku.productName,
          ...toSafeBucket(sku),
        }))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    }))
    .sort((a, b) => b.totalInvoice - a.totalInvoice);

  return (
    <DailySourceStatusClient
      rows={rows}
      sources={sources}
      filters={{ from, to, sourceId }}
      totals={toSafeBucket(totals)}
    />
  );
}