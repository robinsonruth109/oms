import { getBangladeshDayRange, formatBangladeshDateTime, getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { appendReadyOrderRows, ensureReadyOrderSheetHeader } from "./client";
import { decryptGoogleServiceAccount } from "./settings";

function itemText(items: Array<{ productSku: string; productName: string; quantity: number }>) {
  return items.map((item) => `${item.productSku} - ${item.productName} × ${item.quantity}`).join(" | ");
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
        page: { select: { name: true } },
        calledByUser: { select: { name: true, username: true } },
        items: { select: { productSku: true, productName: true, quantity: true } },
      },
      orderBy: [{ readyToShipAt: "asc" }, { createdAt: "asc" }],
    });

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

    const rows = pending.map((order) => [
      order.id,
      getBangladeshDateInputValue(order.readyToShipAt),
      order.invoiceId || "",
      order.orderId || order.externalOrderId || "",
      order.customerName,
      order.phone,
      order.address,
      order.source.name,
      order.page?.name || "",
      order.courier || "",
      itemText(order.items),
      Number(order.subtotal),
      Number(order.deliveryCharge),
      Number(order.discount),
      Number(order.advance),
      Number(order.totalAmount),
      order.pathaoConsignmentId || "",
      order.pathaoOrderStatus || order.pathaoOrderStatusSlug || "",
      order.calledByUser ? `${order.calledByUser.name} (@${order.calledByUser.username})` : "",
      order.calledAt ? formatBangladeshDateTime(order.calledAt) : "",
      formatBangladeshDateTime(order.createdAt),
      formatBangladeshDateTime(syncedAt),
    ]);

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
      data: { lastSyncAt: new Date(), lastSyncBusinessDate: input.businessDate, lastSyncStatus: "FAILED", lastSyncMessage: message },
    }).catch(() => undefined);
    throw error;
  }
}
