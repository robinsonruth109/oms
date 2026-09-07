import { getBangladeshDayRange } from "@/lib/bangladesh-time";
import { appendReadyOrderRows, ensureReadyOrderSheetHeader } from "./client";
import { decryptGoogleServiceAccount } from "./settings";
import {
  buildReadyOrderSheetRow,
  MAX_READY_ORDER_PRODUCT_COLUMNS,
} from "./ready-order-row";

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
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ readyToShipAt: "asc" }, { createdAt: "asc" }],
    });

    const tooManyItems = orders.filter(
      (order) => order.items.length > MAX_READY_ORDER_PRODUCT_COLUMNS
    );
    if (tooManyItems.length) {
      const invoices = tooManyItems
        .slice(0, 10)
        .map((order) => order.invoiceId || order.id)
        .join(", ");
      throw new Error(
        `Google Sheet supports up to ${MAX_READY_ORDER_PRODUCT_COLUMNS} product lines per order. ` +
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

    const rows = pending.map((order) => buildReadyOrderSheetRow(order));

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
