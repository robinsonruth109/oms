import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import {
  getEligibleCustomerDataWhere,
} from "@/lib/customer-data-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCH_SIZE = 500;

const orderExportSelect = {
  id: true,
  orderId: true,
  invoiceId: true,
  integrationId: true,
  externalOrderId: true,
  sourceId: true,
  pageId: true,
  customerName: true,
  address: true,
  phone: true,
  subtotal: true,
  discount: true,
  advance: true,
  deliveryCharge: true,
  totalAmount: true,
  orderStatus: true,
  courier: true,
  note: true,
  calledByUserId: true,
  calledAt: true,
  invoiceDownloaded: true,
  csvDownloaded: true,
  readyToShipAt: true,
  checkoutRequestId: true,
  metaPurchaseEventId: true,
  metaPurchaseSentAt: true,
  metaPurchaseStatus: true,
  metaPurchaseError: true,
  metaPurchaseResponse: true,
  createdAt: true,
  updatedAt: true,
  integration: { select: { name: true } },
  source: { select: { name: true } },
  page: { select: { name: true } },
  calledByUser: { select: { name: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      productId: true,
      productSku: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

type ExportOrder = Prisma.OrderGetPayload<{
  select: typeof orderExportSelect;
}>;

function safeCsvText(value: unknown) {
  let text = String(value ?? "");

  // Prevent cells supplied by customers from becoming spreadsheet formulas.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

async function requireAdmin() {
  const [{ getServerSession }, { authOptions }] =
    await Promise.all([
      import("next-auth"),
      import("@/lib/auth"),
    ]);

  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN";
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const scope =
    request.nextUrl.searchParams.get("scope") === "eligible"
      ? "eligible"
      : "all";

  const { prisma } = await import("@/lib/prisma");

  const headers = [
    "Database Order ID",
    "Order ID",
    "Invoice ID",
    "Integration ID",
    "Integration Name",
    "External Order ID",
    "Source ID",
    "Source Name",
    "Page ID",
    "Page Name",
    "Customer Name",
    "Phone",
    "Address",
    "Subtotal",
    "Discount",
    "Advance",
    "Delivery Charge",
    "Total Amount",
    "Order Status",
    "Courier",
    "Note",
    "Called By User ID",
    "Called By User Name",
    "Called At",
    "Invoice Downloaded",
    "CSV Downloaded",
    "Ready To Ship At",
    "Checkout Request ID",
    "Meta Purchase Event ID",
    "Meta Purchase Sent At",
    "Meta Purchase Status",
    "Meta Purchase Error",
    "Meta Purchase Response",
    "Created At",
    "Updated At",
    "Items JSON",
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // UTF-8 BOM helps Excel display Bangla text correctly.
        controller.enqueue(
          encoder.encode(
            `\uFEFF${headers.map(safeCsvText).join(",")}\r\n`
          )
        );

        let lastId: string | null = null;

        while (true) {
          const baseWhere =
            scope === "eligible"
              ? getEligibleCustomerDataWhere()
              : {};

          const orders: ExportOrder[] = await prisma.order.findMany({
            where: {
              ...baseWhere,
              ...(lastId
                ? {
                    id: {
                      gt: lastId,
                    },
                  }
                : {}),
            },
            orderBy: {
              id: "asc",
            },
            take: BATCH_SIZE,
            select: orderExportSelect,
          });

          if (orders.length === 0) {
            break;
          }

          for (const order of orders) {
            const itemsJson = JSON.stringify(
              order.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                productSku: item.productSku,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toString(),
                lineTotal: item.lineTotal.toString(),
                createdAt: item.createdAt.toISOString(),
                updatedAt: item.updatedAt.toISOString(),
              }))
            );

            const row = [
              order.id,
              order.orderId,
              order.invoiceId,
              order.integrationId,
              order.integration?.name,
              order.externalOrderId,
              order.sourceId,
              order.source.name,
              order.pageId,
              order.page?.name,
              order.customerName,
              order.phone,
              order.address,
              order.subtotal.toString(),
              order.discount.toString(),
              order.advance.toString(),
              order.deliveryCharge.toString(),
              order.totalAmount.toString(),
              order.orderStatus,
              order.courier,
              order.note,
              order.calledByUserId,
              order.calledByUser?.name,
              iso(order.calledAt),
              order.invoiceDownloaded,
              order.csvDownloaded,
              iso(order.readyToShipAt),
              order.checkoutRequestId,
              order.metaPurchaseEventId,
              iso(order.metaPurchaseSentAt),
              order.metaPurchaseStatus,
              order.metaPurchaseError,
              order.metaPurchaseResponse,
              iso(order.createdAt),
              iso(order.updatedAt),
              itemsJson,
            ];

            controller.enqueue(
              encoder.encode(
                `${row.map(safeCsvText).join(",")}\r\n`
              )
            );
          }

          lastId = orders[orders.length - 1].id;

          if (orders.length < BATCH_SIZE) {
            break;
          }
        }

        controller.close();
      } catch (error) {
        console.error(
          "Customer data CSV export failed:",
          error
        );
        controller.error(error);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename =
    scope === "eligible"
      ? `gloss-and-glows-customer-data-eligible-${date}.csv`
      : `gloss-and-glows-complete-order-data-${date}.csv`;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
