import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  importedDateToUtc,
  makeRestoreBatchNo,
  normalizeImportedPhone,
  type StockOutCommitRow,
} from "@/lib/stock-out-restore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CommitBody = {
  fileName?: string;
  rows?: StockOutCommitRow[];
};

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 100) / 100
    : 0;
}

function qty(value: unknown) {
  const number = Math.trunc(Number(value ?? 1));
  return Number.isFinite(number) && number > 0 ? number : 1;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as CommitBody;
    const rows = Array.isArray(body.rows)
      ? body.rows.filter((row) => row.include)
      : [];

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: "No verified rows selected." },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const pageIds = [...new Set(rows.map((row) => row.pageId).filter(Boolean))];
    const sourceIds = [...new Set(rows.map((row) => row.sourceId).filter(Boolean))];
    const courierSlugs = [
      ...new Set(rows.map((row) => row.courierSlug).filter(Boolean)),
    ];
    const productIds = [
      ...new Set(
        rows.flatMap((row) => row.items.map((item) => item.productId)).filter(Boolean)
      ),
    ];

    const [pages, sources, couriers, products] = await Promise.all([
      prisma.page.findMany({
        where: { id: { in: pageIds }, status: true },
        select: { id: true, name: true },
      }),
      prisma.orderSource.findMany({
        where: { id: { in: sourceIds }, status: true },
        select: { id: true, name: true },
      }),
      prisma.courier.findMany({
        where: { slug: { in: courierSlugs }, status: true },
        select: { slug: true, name: true },
      }),
      prisma.product.findMany({
        where: { id: { in: productIds }, status: true },
        select: { id: true, sku: true, name: true, sellingPrice: true },
      }),
    ]);

    const pageMap = new Map(pages.map((row) => [row.id, row]));
    const sourceMap = new Map(sources.map((row) => [row.id, row]));
    const courierMap = new Map(couriers.map((row) => [row.slug, row]));
    const productMap = new Map(products.map((row) => [row.id, row]));

    const invoiceIds = rows.map((row) => row.invoiceId).filter(Boolean);
    const existingOrders = await prisma.order.findMany({
      where: { invoiceId: { in: invoiceIds } },
      select: {
        id: true,
        invoiceId: true,
        orderStatus: true,
      },
    });
    const existingMap = new Map(
      existingOrders
        .filter((row) => row.invoiceId)
        .map((row) => [String(row.invoiceId), row])
    );

    const batch = await prisma.stockOutRestoreBatch.create({
      data: {
        batchNo: makeRestoreBatchNo(),
        fileName: String(body.fileName || "stock-out-restore.csv").slice(0, 191),
        totalRows: rows.length,
        createdByUserId: session.user.id,
      },
    });

    let importedCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const results: {
      rowNumber: number;
      invoiceId: string;
      status: string;
      message: string;
      orderId?: string;
    }[] = [];

    for (const row of rows) {
      let resultStatus = "FAILED";
      let resultMessage = "";
      let resultOrderId: string | null = null;

      try {
        if (
          !row.invoiceId ||
          !row.pageId ||
          !row.sourceId ||
          !row.courierSlug ||
          !row.importedDate ||
          !row.customerName ||
          !row.phone ||
          !row.address ||
          !row.items.length
        ) {
          throw new Error("Required reviewed fields are incomplete.");
        }

        if (!pageMap.has(row.pageId)) {
          throw new Error("Selected page is invalid/inactive.");
        }

        if (!sourceMap.has(row.sourceId)) {
          throw new Error("Selected source is invalid/inactive.");
        }

        if (!courierMap.has(row.courierSlug)) {
          throw new Error("Selected courier is invalid/inactive.");
        }

        const preparedItems = row.items.map((item) => {
          const product = productMap.get(item.productId);

          if (!product) {
            throw new Error(
              `Product selection is invalid for CSV item ${item.csvSku || item.name}.`
            );
          }

          const quantity = qty(item.quantity);
          const unitPrice =
            money(item.unitPrice) > 0
              ? money(item.unitPrice)
              : money(product.sellingPrice);

          return {
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            quantity,
            unitPrice,
            lineTotal: Math.round(quantity * unitPrice * 100) / 100,
          };
        });

        const subtotal = preparedItems.reduce(
          (sum, item) => sum + item.lineTotal,
          0
        );
        const deliveryCharge = money(row.deliveryCharge);
        const discount = money(row.discount);
        const calculatedTotal = Math.max(
          0,
          Math.round((subtotal + deliveryCharge - discount) * 100) / 100
        );
        const totalAmount =
          money(row.grandTotal) > 0 ? money(row.grandTotal) : calculatedTotal;
        const normalizedPhone = normalizeImportedPhone(row.phone);

        if (!normalizedPhone) {
          throw new Error("Phone number is invalid/empty.");
        }

        const currentExisting = existingMap.get(row.invoiceId);

        if (row.action === "RESTORE") {
          if (!currentExisting || currentExisting.orderStatus !== "STOCK_OUT") {
            throw new Error(
              currentExisting
                ? `Invoice status changed to ${currentExisting.orderStatus}; restore blocked.`
                : "Existing STOCK_OUT order is no longer available."
            );
          }

          const updated = await prisma.$transaction(async (tx) => {
            const order = await tx.order.update({
              where: { id: currentExisting.id },
              data: {
                sourceId: row.sourceId,
                pageId: row.pageId,
                customerName: row.customerName.trim(),
                phone: normalizedPhone,
                address: row.address.trim(),
                subtotal,
                discount,
                advance: 0,
                deliveryCharge,
                totalAmount,
                courier: row.courierSlug,
                orderStatus: "READY_TO_SHIP",
                readyToShipAt: new Date(),
                invoiceDownloaded: false,
                csvDownloaded: false,
                holdByUserId: null,
                holdAt: null,
                holdUntil: null,
                note: {
                  set: `[Stock Out Restore Import ${batch.batchNo}] Historical STOCK_OUT order restored to READY_TO_SHIP.`,
                },
              },
            });

            await tx.orderItem.deleteMany({
              where: { orderId: order.id },
            });

            await tx.orderItem.createMany({
              data: preparedItems.map((item) => ({
                orderId: order.id,
                productId: item.productId,
                productSku: item.productSku,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
              })),
            });

            return order;
          });

          restoredCount += 1;
          resultStatus = "RESTORED";
          resultMessage = "Existing STOCK_OUT order restored to Ready to Ship.";
          resultOrderId = updated.id;
        } else {
          if (currentExisting) {
            skippedCount += 1;
            resultStatus = "SKIPPED";
            resultMessage = `Invoice already exists with status ${currentExisting.orderStatus}.`;
          } else {
            const created = await prisma.$transaction(async (tx) => {
              const order = await tx.order.create({
                data: {
                  invoiceId: row.invoiceId,
                  sourceId: row.sourceId,
                  pageId: row.pageId,
                  customerName: row.customerName.trim(),
                  phone: normalizedPhone,
                  address: row.address.trim(),
                  subtotal,
                  discount,
                  advance: 0,
                  deliveryCharge,
                  totalAmount,
                  courier: row.courierSlug,
                  orderStatus: "READY_TO_SHIP",
                  readyToShipAt: new Date(),
                  invoiceDownloaded: false,
                  csvDownloaded: false,
                  note: `[Stock Out Restore Import ${batch.batchNo}] Historical stock-out memo imported directly to READY_TO_SHIP. CSV import date: ${row.importedDate}.`,
                  createdAt: importedDateToUtc(row.importedDate),
                },
              });

              await tx.orderItem.createMany({
                data: preparedItems.map((item) => ({
                  orderId: order.id,
                  productId: item.productId,
                  productSku: item.productSku,
                  productName: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                })),
              });

              return order;
            });

            importedCount += 1;
            resultStatus = "IMPORTED";
            resultMessage =
              "Historical order created and sent directly to Ready to Ship.";
            resultOrderId = created.id;
            existingMap.set(row.invoiceId, {
              id: created.id,
              invoiceId: row.invoiceId,
              orderStatus: "READY_TO_SHIP",
            });
          }
        }
      } catch (error) {
        failedCount += 1;
        resultStatus = "FAILED";
        resultMessage =
          error instanceof Error ? error.message : "Import failed.";
      }

      await prisma.stockOutRestoreItem.create({
        data: {
          batchId: batch.id,
          rowNumber: row.rowNumber,
          invoiceId: row.invoiceId || `ROW-${row.rowNumber}`,
          resultStatus,
          resultMessage,
          orderId: resultOrderId,
          rawData: row as object,
        },
      });

      results.push({
        rowNumber: row.rowNumber,
        invoiceId: row.invoiceId,
        status: resultStatus,
        message: resultMessage,
        ...(resultOrderId ? { orderId: resultOrderId } : {}),
      });
    }

    await prisma.stockOutRestoreBatch.update({
      where: { id: batch.id },
      data: {
        importedCount,
        restoredCount,
        skippedCount,
        failedCount,
      },
    });

    return NextResponse.json({
      success: failedCount === 0,
      partialSuccess: importedCount + restoredCount > 0,
      batchNo: batch.batchNo,
      importedCount,
      restoredCount,
      skippedCount,
      failedCount,
      results,
      message: `${importedCount} new historical order(s) imported, ${restoredCount} STOCK_OUT order(s) restored, ${skippedCount} skipped, ${failedCount} failed.`,
    });
  } catch (error) {
    console.error("Stock Out restore commit failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to commit Stock Out restore batch.",
      },
      { status: 500 }
    );
  }
}
