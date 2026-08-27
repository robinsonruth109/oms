import { formatBangladeshDateTime, getBangladeshDateInputValue } from "@/lib/bangladesh-time";

import { notFound } from "next/navigation";
import AllOrderViewClient from "./view-client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function AllOrderViewPage({ params }: Props) {
  const { prisma } = await import("@/lib/prisma");
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      source: true,
      page: true,
      integration: true,
      calledByUser: {
        select: { id: true, name: true, username: true },
      },
      invoiceBatchItems: {
        include: {
          batch: {
            include: {
              createdByUser: {
                select: { id: true, name: true, username: true },
              },
            },
          },
        },
      },
      postPrintActionLogs: {
        include: {
          performedByUser: {
            select: { id: true, name: true, username: true },
          },
        },
      },
      auditEvents: {
        include: {
          performedByUser: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const historyRaw: {
    id: string;
    type: string;
    title: string;
    actor: string;
    atDate: Date;
    detail?: string;
  }[] = [];

  const createdAudit = order.auditEvents
    .filter((event) => event.eventType === "CREATED")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  historyRaw.push({
    id: `created-${order.id}`,
    type: "CREATED",
    title: "Order created / imported",
    actor:
      createdAudit?.performedByUser?.name ||
      createdAudit?.actorLabel ||
      (order.integration
        ? `${order.integration.name} integration`
        : `${order.source?.name || "OMS"} / System`),
    atDate: order.createdAt,
    detail: order.integration
      ? `Platform: ${order.integration.platform}`
      : "Historical/system-created orders may not have a human creator recorded.",
  });

  const hasRecordedCallAudit = order.auditEvents.some(
    (event) =>
      event.eventType === "CALLED" || event.eventType === "CANCELLED"
  );

  if (order.calledAt && order.calledByUser && !hasRecordedCallAudit) {
    historyRaw.push({
      id: `legacy-call-${order.id}`,
      type: "CALLED",
      title: "Called / calling result submitted",
      actor: order.calledByUser.name || `@${order.calledByUser.username}`,
      atDate: order.calledAt,
      detail: `Current result: ${order.orderStatus}`,
    });
  }

  for (const item of order.invoiceBatchItems) {
    historyRaw.push({
      id: `invoice-${item.id}`,
      type: "INVOICE_PRINTED",
      title: "Invoice batch printed / downloaded",
      actor:
        item.batch.createdByUser.name ||
        `@${item.batch.createdByUser.username}`,
      atDate: item.batch.createdAt,
      detail: `Batch: ${item.batch.batchNo}`,
    });
  }

  for (const log of order.postPrintActionLogs) {
    historyRaw.push({
      id: `post-print-${log.id}`,
      type: log.actionType,
      title:
        log.actionType === "CANCELLED"
          ? "Order cancelled after print"
          : "Order marked Stock Out after print",
      actor:
        log.performedByUser.name || `@${log.performedByUser.username}`,
      atDate: log.createdAt,
      detail: `${log.actionMethod} · ${log.previousStatus} → ${log.newStatus}`,
    });
  }

  for (const event of order.auditEvents) {
    if (event.eventType === "CREATED") continue;

    historyRaw.push({
      id: `audit-${event.id}`,
      type: event.eventType,
      title: event.title,
      actor:
        event.performedByUser?.name ||
        event.actorLabel ||
        "OMS / System",
      atDate: event.createdAt,
      detail:
        event.eventType === "UPDATED_AFTER_PRINT"
          ? "Printed memo may be outdated — Packaging Section should be contacted."
          : undefined,
    });
  }

  const history = historyRaw
    .sort((a, b) => b.atDate.getTime() - a.atDate.getTime())
    .map(({ atDate, ...event }) => ({
      ...event,
      at: formatBangladeshDateTime(atDate),
    }));

  const [products, couriers, pages] = await Promise.all([
    prisma.product.findMany({
      where: { status: true },
      include: { parent: true },
      orderBy: {
        sku: "asc",
      },
    }),
    prisma.courier.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <AllOrderViewClient
      order={{
        id: order.id,
        invoiceId: order.invoiceId,
        externalOrderId: order.externalOrderId,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        advance: Number(order.advance),
        deliveryCharge: Number(order.deliveryCharge),
        totalAmount: Number(order.totalAmount),
        orderStatus: order.orderStatus,
        courier: order.courier,
        note: order.note,
        invoiceDownloaded: order.invoiceDownloaded,
        pageId: order.pageId,
        readyToShipAt: order.readyToShipAt
          ? getBangladeshDateInputValue(order.readyToShipAt)
          : getBangladeshDateInputValue(),
        source: {
          id: order.source?.id || "",
          name: order.source?.name || "",
          type: order.source?.type || "",
        },
        page: order.page
          ? {
              id: order.page.id,
              name: order.page.name,
            }
          : null,
        integration: order.integration
          ? {
              id: order.integration.id,
              name: order.integration.name,
              slug: order.integration.slug,
              platform: order.integration.platform,
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }}
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: Number(p.sellingPrice),
        parentSku: p.parent.sku,
      }))}
      couriers={couriers.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))}
      pages={pages}
      history={history}
    />
  );
}