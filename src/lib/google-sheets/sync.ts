import { getBangladeshDayRange } from "@/lib/bangladesh-time";
import { appendReadyOrderRows, ensureReadyOrderSheetHeader } from "./client";
import { decryptGoogleServiceAccount } from "./settings";

const MAX_PRODUCT_COLUMNS = 8;

function formatSheetDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "Pending Confirmation",
    READY_TO_SHIP: "Ready",
    NO_ANSWER: "No Answer",
    PHONE_OFF: "Phone Off",
    CANCELLED: "Cancelled",
    DOUBLE_ORDER: "Double Order",
    STOCK_OUT: "Stock Out",
    RETURNED: "Returned",
    PARTIAL_RETURN: "Partial Return",
  };

  return labels[status] || status.replace(/_/g, " ");
}

type SheetOrderItem = {
  productSku: string;
  quantity: number;
  unitPrice: unknown;
  product: {
    parent: {
      sku: string;
    };
  } | null;
};

function productColumns(items: SheetOrderItem[]) {
  const columns: Array<string | number> = [];

  for (let index = 0; index < MAX_PRODUCT_COLUMNS; index += 1) {
    const item = items[index];

    if (!item) {
      columns.push("", "", "", "");
      continue;
    }

    columns.push(
      item.product?.parent.sku || "",
      item.productSku || "",
      Number(item.unitPrice),
      item.quantity
    );
  }

  return columns;
}

export async function runReadyOrderSheetSync(input: {
  businessDate: string;
  mode: "MANUAL" | "AUTO";
  triggeredByUserId?: string | null;
}) {
  const { prisma } = await import("@/lib/prisma");
  const setting = await prisma.readyOrderSheetSetting.findUnique({ where: { id: "default" } });
  if (!setting?.spreadsheetId) throw new Error("Google Sheet Spreadsheet ID is not configured.");
  const account = decryptGoogleServiceAccount(setting);
  const sheetName = setting.sheetName || "Data";
  const range = getBangladeshDayRange(input.businessDate);

  const run = await prisma.readyOrderSheetSyncRun.create({
    data: {
      businessDate: input.businessDate,
      mode: input.mode,
      status: "RUNNING",
      triggeredByUserId: input.triggeredByUserId || null,
    },
  });

  try {
    await ensureReadyOrderSheetHeader({ account, spreadsheetId: setting.spreadsheetId, sheetName });

    const orders = await prisma.order.findMany({
      where: {
        orderStatus: "READY_TO_SHIP",
        readyToShipAt: { gte: range.start, lte: range.end },
      },
      include: {
        source: { select: { name: true } },
        items: {
          select: {
            productSku: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                parent: {
                  select: { sku: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ readyToShipAt: "asc" }, { createdAt: "asc" }],
    });

    const tooManyItems = orders.filter((order) => order.items.length > MAX_PRODUCT_COLUMNS);
    if (tooManyItems.length) {
      const invoices = tooManyItems
        .slice(0, 10)
        .map((order) => order.invoiceId || order.id)
        .join(", ");
      throw new Error(
        `Google Sheet supports up to ${MAX_PRODUCT_COLUMNS} product lines per order. ` +
          `${tooManyItems.length} order(s) exceed that limit: ${invoices}${tooManyItems.length > 10 ? ", ..." : ""}.`
      );
    }

    const existing = orders.length
      ? await prisma.readyOrderSheetSyncItem.findMany({
          where: {
            spreadsheetId: setting.spreadsheetId,
            sheetName,
            orderId: { in: orders.map((order) => order.id) },
          },
          select: { orderId: true },
        })
      : [];
    const existingIds = new Set(existing.map((item) => item.orderId));
    const pending = orders.filter((order) => !existingIds.has(order.id));
    const syncedAt = new Date();

    const rows = pending.map((order) => {
      const invoiceId = order.invoiceId || "";

      return [
        // A: OMS UUID
        order.id,
        // B-C: Invoice ID intentionally duplicated to match the required sheet format.
        invoiceId,
        invoiceId,
        // D-H
        order.source.name,
        formatSheetDate(order.readyToShipAt),
        order.customerName,
        String(order.phone || "").trim(),
        order.address,
        // I-AN: Product 1-8 (Parent Code, SKU, Price, Qty)
        ...productColumns(order.items),
        // AO-AT
        Number(order.deliveryCharge),
        Number(order.advance),
        Number(order.discount),
        Number(order.totalAmount),
        order.note || "",
        statusLabel(order.orderStatus),
      ];
    });

    const append = await appendReadyOrderRows({
      account,
      spreadsheetId: setting.spreadsheetId,
      sheetName,
      rows,
    });

    if (pending.length) {
      await prisma.readyOrderSheetSyncItem.createMany({
        data: pending.map((order, index) => ({
          orderId: order.id,
          spreadsheetId: setting.spreadsheetId!,
          sheetName,
          businessDate: input.businessDate,
          sheetRowNumber: append.startRow ? append.startRow + index : null,
          syncedAt,
        })),
        skipDuplicates: true,
      });
    }

    const message = pending.length
      ? `${pending.length} new Ready to Ship order(s) synced to Google Sheet. ${existing.length} already synced order(s) skipped.`
      : `No new orders to sync. ${orders.length} Ready to Ship order(s) for ${input.businessDate} are already stored.`;

    await prisma.$transaction([
      prisma.readyOrderSheetSyncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          totalReadyOrders: orders.length,
          pendingOrders: pending.length,
          appendedOrders: pending.length,
          skippedOrders: existing.length,
          failedOrders: 0,
          message,
          finishedAt: new Date(),
        },
      }),
      prisma.readyOrderSheetSetting.update({
        where: { id: "default" },
        data: {
          lastSyncAt: new Date(),
          lastSyncBusinessDate: input.businessDate,
          ...(input.mode === "AUTO" ? { lastAutoSyncBusinessDate: input.businessDate } : {}),
          lastSyncStatus: "SUCCESS",
          lastSyncMessage: message,
        },
      }),
    ]);

    return { total: orders.length, appended: pending.length, skipped: existing.length, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Sheet sync failed.";
    await prisma.readyOrderSheetSyncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", message, failedOrders: 1, finishedAt: new Date() },
    }).catch(() => undefined);
    await prisma.readyOrderSheetSetting.update({
      where: { id: "default" },
      data: {
        lastSyncAt: new Date(),
        lastSyncBusinessDate: input.businessDate,
        lastSyncStatus: "FAILED",
        lastSyncMessage: message,
      },
    }).catch(() => undefined);
    throw error;
  }
}
