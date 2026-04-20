import { prisma } from "@/lib/prisma";
import StockOutClient from "./stock-out-client";

type StockOutItemRow = {
  orderId: string;
  orderItemId: string;
  invoiceId: string | null;
  customerName: string;
  phone: string;
  pageName: string;
  sourceName: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  deliveryCharge: number;
};

type GroupedStockOutRow = {
  productSku: string;
  productName: string;
  totalInvoiceQty: number;
  totalProductQty: number;
  totalProductPrice: number;
  pageSources: string[];
  orderIds: string[];
  invoices: {
    orderId: string;
    invoiceId: string | null;
    customerName: string;
    phone: string;
    quantity: number;
    lineTotal: number;
    deliveryCharge: number;
    pageName: string;
    sourceName: string;
  }[];
};

export default async function StockOutPage() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: "STOCK_OUT",
    },
    include: {
      items: true,
      page: true,
      source: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const rows: StockOutItemRow[] = orders.flatMap((order) =>
    order.items.map((item) => ({
      orderId: order.id,
      orderItemId: item.id,
      invoiceId: order.invoiceId,
      customerName: order.customerName,
      phone: order.phone,
      pageName: order.page?.name || "N/A",
      sourceName: order.source.name,
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      deliveryCharge: Number(order.deliveryCharge),
    }))
  );

  const groupedMap = new Map<string, GroupedStockOutRow>();

  for (const row of rows) {
    const key = row.productSku;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        productSku: row.productSku,
        productName: row.productName,
        totalInvoiceQty: 0,
        totalProductQty: 0,
        totalProductPrice: 0,
        pageSources: [],
        orderIds: [],
        invoices: [],
      });
    }

    const group = groupedMap.get(key)!;

    group.totalInvoiceQty += 1;
    group.totalProductQty += row.quantity;
    group.totalProductPrice += row.lineTotal;

    const pageSource = `${row.pageName} / ${row.sourceName}`;
    if (!group.pageSources.includes(pageSource)) {
      group.pageSources.push(pageSource);
    }

    if (!group.orderIds.includes(row.orderId)) {
      group.orderIds.push(row.orderId);
    }

    group.invoices.push({
      orderId: row.orderId,
      invoiceId: row.invoiceId,
      customerName: row.customerName,
      phone: row.phone,
      quantity: row.quantity,
      lineTotal: row.lineTotal,
      deliveryCharge: row.deliveryCharge,
      pageName: row.pageName,
      sourceName: row.sourceName,
    });
  }

  const groupedRows = Array.from(groupedMap.values()).sort((a, b) =>
    a.productSku.localeCompare(b.productSku)
  );

  return (
    <StockOutClient
      rows={groupedRows}
    />
  );
}