"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { createPathaoBulkOrders } from "@/lib/pathao/client";
import {
  preparePathaoOrder,
  validatePathaoOrder,
} from "@/lib/pathao/orders";
import type { PreparedPathaoOrder } from "@/lib/pathao/types";
import { applyInventorySaleForOrderTx } from "@/lib/inventory";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
  getBangladeshTodayRange,
} from "@/lib/bangladesh-time";

type BatchActionState = {
  success: boolean;
  message: string;
  batchId?: string;
  downloadUrl?: string;
};

function makeBatchNo(prefix: string) {
  // The batch number only needs uniqueness/readability. Database timestamps
  // and page display remain Bangladesh-time aware.
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `${prefix}-${stamp}`;
}

function parseSelectedIds(raw: string) {
  try {
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  } catch {
    return [];
  }
}

async function requirePackagingSession() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    throw new Error("Unauthorized action.");
  }

  return session;
}

export async function createInvoiceBatch(
  _prevState: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  try {
    const session = await requirePackagingSession();
    const { prisma } = await import("@/lib/prisma");

    const selectedIds = parseSelectedIds(
      String(formData.get("selectedIds") || "[]")
    );
    const courier = String(formData.get("courier") || "").trim();
    const fromDate = String(formData.get("fromDate") || "").trim();
    const toDate = String(formData.get("toDate") || "").trim();
    const bangladeshToday = getBangladeshDateInputValue();

    if (fromDate !== bangladeshToday || toDate !== bangladeshToday) {
      return {
        success: false,
        message:
          `Invoice batch blocked. From Date and To Date must both be today's Bangladesh date (${bangladeshToday}). Future or previous memo dates cannot be downloaded.`,
      };
    }

    if (!selectedIds.length) {
      return { success: false, message: "Please select at least one order." };
    }

    const todayRange = getBangladeshTodayRange();

    const orders = await prisma.order.findMany({
      where: {
        id: { in: selectedIds },
        orderStatus: "READY_TO_SHIP",
        invoiceDownloaded: false,
        readyToShipAt: {
          gte: todayRange.start,
          lte: todayRange.end,
        },
        ...(courier ? { courier } : {}),
      },
    });

    if (orders.length !== selectedIds.length) {
      return {
        success: false,
        message:
          "Invoice batch blocked. One or more selected orders are not eligible for today's Bangladesh Ready to Ship memo, were already invoiced, or do not match the selected courier.",
      };
    }

    if (!orders.length) {
      return {
        success: false,
        message: "No valid non-invoiced ready-to-ship orders found.",
      };
    }

    const uniqueCouriers = [
      ...new Set(
        orders
          .map((order) => order.courier)
          .filter((value): value is string => Boolean(value))
      ),
    ];

    if (uniqueCouriers.length !== 1) {
      return {
        success: false,
        message: "Selected orders must belong to exactly one courier.",
      };
    }

    const batchNo = makeBatchNo("INV");

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.invoiceBatch.create({
        data: {
          batchNo,
          courier: uniqueCouriers[0],
          totalOrders: orders.length,
          createdByUserId: session.user.id,
        },
      });

      await tx.invoiceBatchItem.createMany({
        data: orders.map((order) => ({
          batchId: createdBatch.id,
          orderId: order.id,
        })),
      });

      await tx.order.updateMany({
        where: { id: { in: orders.map((order) => order.id) } },
        data: { invoiceDownloaded: true },
      });

      return createdBatch;
    });

    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: `Invoice batch created successfully: ${batch.batchNo}`,
      batchId: batch.id,
      downloadUrl: `/api/ready-to-ship/invoice-batch/${batch.id}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create invoice batch.",
    };
  }
}

export async function createCsvBatch(
  _prevState: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  try {
    const session = await requirePackagingSession();
    const { prisma } = await import("@/lib/prisma");

    const selectedIds = parseSelectedIds(
      String(formData.get("selectedIds") || "[]")
    );
    const selectedCourierSlug = String(formData.get("courier") || "").trim();

    if (!selectedCourierSlug) {
      return {
        success: false,
        message:
          "Select one courier first. Pathao parcels can only be submitted to the courier selected in the filter.",
      };
    }

    if (!selectedIds.length) {
      return { success: false, message: "Please select at least one order." };
    }

    const courier = await prisma.courier.findFirst({
      where: {
        slug: selectedCourierSlug,
        status: true,
      },
    });

    if (!courier) {
      return { success: false, message: "Selected courier is invalid or inactive." };
    }

    if (!courier.pathaoEnabled) {
      return {
        success: false,
        message: `${courier.name} does not have Pathao API enabled.`,
      };
    }

    if (!courier.pathaoStoreId) {
      return {
        success: false,
        message:
          `${courier.name} has no Pathao Store ID. Test the connection from Courier Master first.`,
      };
    }

    // Server-side courier enforcement: even a manipulated browser request
    // cannot submit another courier's order through this Pathao account.
    const orders = await prisma.order.findMany({
      where: {
        id: { in: selectedIds },
        orderStatus: "READY_TO_SHIP",
        csvDownloaded: false,
        courier: selectedCourierSlug,
      },
      include: {
        items: true,
      },
    });

    const missingFromCourier = selectedIds.length - orders.length;
    if (!orders.length) {
      return {
        success: false,
        message:
          "No valid non-CSV orders belonging to the selected courier were found.",
      };
    }

    const alreadyPathao = orders.filter(
      (order) =>
        Boolean(order.pathaoConsignmentId) ||
        ["SUBMITTING", "SUBMITTED", "CONSIGNMENT_CREATED"].includes(
          order.pathaoSubmissionStatus
        )
    );

    const candidates = orders.filter(
      (order) =>
        !order.pathaoConsignmentId &&
        !["SUBMITTING", "SUBMITTED", "CONSIGNMENT_CREATED"].includes(
          order.pathaoSubmissionStatus
        )
    );

    const invalid: { id: string; invoice: string; error: string }[] = [];
    const prepared: PreparedPathaoOrder[] = [];

    for (const order of candidates) {
      const errors = validatePathaoOrder(order);

      if (errors.length) {
        invalid.push({
          id: order.id,
          invoice: order.invoiceId || order.orderId || order.id,
          error: errors.join(" "),
        });
        continue;
      }

      prepared.push(preparePathaoOrder(order, courier.pathaoStoreId));
    }

    if (!prepared.length) {
      const reasons = invalid
        .slice(0, 5)
        .map((row) => `${row.invoice}: ${row.error}`)
        .join(" | ");

      return {
        success: false,
        message:
          `Nothing was submitted to Pathao. ${
            alreadyPathao.length
              ? `${alreadyPathao.length} selected order(s) were already submitted. `
              : ""
          }${reasons}`,
      };
    }

    const preparedIds = prepared.map((row) => row.orderId);

    // Claim orders before calling external API. If the button is clicked twice
    // concurrently, only the first request will be eligible for a new submission.
    const claimed = await prisma.order.updateMany({
      where: {
        id: { in: preparedIds },
        pathaoSubmissionStatus: { in: ["NOT_SUBMITTED", "FAILED"] },
        pathaoConsignmentId: null,
      },
      data: {
        pathaoCourierId: courier.id,
        pathaoSubmissionStatus: "SUBMITTING",
        pathaoMerchantOrderId: null,
        pathaoLastError: null,
      },
    });

    if (claimed.count !== preparedIds.length) {
      await prisma.order.updateMany({
        where: {
          id: { in: preparedIds },
          pathaoSubmissionStatus: "SUBMITTING",
          pathaoCourierId: courier.id,
        },
        data: {
          pathaoSubmissionStatus: "FAILED",
          pathaoLastError:
            "Submission was stopped because one or more selected orders changed state concurrently. Retry safely.",
        },
      });

      return {
        success: false,
        message:
          "Submission stopped because one or more selected orders were already being processed. Refresh and retry.",
      };
    }

    let pathaoResponse;
    try {
      pathaoResponse = await createPathaoBulkOrders(
        courier.id,
        prepared.map((row) => row.payload)
      );

      if (Number(pathaoResponse.code || 202) !== 202 || pathaoResponse.data !== true) {
        throw new Error(
          pathaoResponse.message || "Pathao did not accept the bulk order request."
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Pathao bulk submission failed.";

      await prisma.order.updateMany({
        where: { id: { in: preparedIds } },
        data: {
          pathaoSubmissionStatus: "FAILED",
          pathaoLastError: errorMessage,
          pathaoRawResponse: errorMessage,
        },
      });

      return {
        success: false,
        message: `Pathao rejected/failed the bulk request. No CSV batch was completed. ${errorMessage}`,
      };
    }

    const batchNo = makeBatchNo("CSV");
    const submittedAt = new Date();
    const stockWarnings: string[] = [];

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.csvBatch.create({
        data: {
          batchNo,
          courier: selectedCourierSlug,
          totalOrders: preparedIds.length,
          createdByUserId: session.user.id,
        },
      });

      await tx.csvBatchItem.createMany({
        data: preparedIds.map((orderId) => ({
          batchId: createdBatch.id,
          orderId,
        })),
      });

      for (const preparedOrder of prepared) {
        await tx.order.update({
          where: { id: preparedOrder.orderId },
          data: {
            csvDownloaded: true,
            pathaoCourierId: courier.id,
            pathaoMerchantOrderId: preparedOrder.invoiceId,
            pathaoSubmissionStatus: "SUBMITTED",
            pathaoSubmittedAt: submittedAt,
            pathaoAmountToCollect: preparedOrder.payload.amount_to_collect,
            pathaoLastSyncedAt: submittedAt,
            pathaoLastError: null,
            pathaoRawResponse: JSON.stringify(pathaoResponse),
          },
        });

        const inventory = await applyInventorySaleForOrderTx(
          tx,
          preparedOrder.orderId,
          session.user.id
        );
        stockWarnings.push(...inventory.warnings);
      }

      return createdBatch;
    }, { timeout: 30_000 });

    // Validation failures remain Non CSV and can be corrected/retried.
    for (const row of invalid) {
      await prisma.order.update({
        where: { id: row.id },
        data: {
          pathaoCourierId: courier.id,
          pathaoSubmissionStatus: "FAILED",
          pathaoLastError: row.error,
        },
      });
    }

    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/pathao-orders");
    revalidatePath("/dashboard/stock-control");
    revalidatePath("/dashboard/products");

    const warnings = [
      missingFromCourier > 0
        ? `${missingFromCourier} selected order(s) did not belong to the selected courier/eligible tab and were ignored.`
        : "",
      alreadyPathao.length
        ? `${alreadyPathao.length} already-submitted Pathao order(s) were skipped.`
        : "",
      invalid.length
        ? `${invalid.length} invalid order(s) were NOT marked CSV and remain retryable: ${invalid
            .slice(0, 3)
            .map((row) => `${row.invoice} (${row.error})`)
            .join("; ")}`
        : "",
      stockWarnings.length
        ? `Stock warning: ${[...new Set(stockWarnings)].slice(0, 5).join(" ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      success: true,
      message: `Pathao accepted ${preparedIds.length} order(s) for ${
        courier.name
      }. CSV batch ${batch.batchNo} created. Consignment IDs will be stored when Pathao sends webhook updates.${
        warnings ? ` ${warnings}` : ""
      }`,
      batchId: batch.id,
      downloadUrl: `/api/ready-to-ship/csv-batch/${batch.id}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create Pathao CSV batch.",
    };
  }
}

const PUSH_ALL_CHUNK_SIZE = 50;

function makePushAllBatchNo() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `AUTOCSV-${stamp}-${suffix}`;
}

function chunkArray<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export async function pushAllToAssignedCouriers(
  _prevState: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  try {
    const session = await requirePackagingSession();
    const { prisma } = await import("@/lib/prisma");

    const courierFilter = String(formData.get("courier") || "").trim();
    const fromDate = String(formData.get("fromDate") || "").trim();
    const toDate = String(formData.get("toDate") || "").trim();

    const readyToShipAt =
      fromDate || toDate
        ? {
            ...(fromDate ? { gte: bangladeshDateStartUtc(fromDate) } : {}),
            ...(toDate ? { lte: bangladeshDateEndUtc(toDate) } : {}),
          }
        : undefined;

    // Important: this query is intentionally NOT limited to the 200 rows shown
    // in the UI. "Push All" means every eligible Non CSV order matching the
    // current courier/date filters.
    const orders = await prisma.order.findMany({
      where: {
        orderStatus: "READY_TO_SHIP",
        csvDownloaded: false,
        ...(courierFilter ? { courier: courierFilter } : {}),
        ...(readyToShipAt ? { readyToShipAt } : {}),
      },
      include: {
        items: true,
      },
      orderBy: {
        readyToShipAt: "asc",
      },
    });

    if (!orders.length) {
      return {
        success: false,
        message: "No Non CSV Ready to Ship orders match the current filters.",
      };
    }

    const ordersWithoutCourier = orders.filter((order) => !order.courier);
    const courierSlugs = [
      ...new Set(
        orders
          .map((order) => order.courier)
          .filter((value): value is string => Boolean(value))
      ),
    ];

    const couriers = courierSlugs.length
      ? await prisma.courier.findMany({
          where: {
            slug: { in: courierSlugs },
            status: true,
          },
        })
      : [];

    const courierBySlug = new Map(couriers.map((row) => [row.slug, row]));

    let submittedCount = 0;
    let alreadySubmittedCount = 0;
    let invalidCount = 0;
    let failedCount = 0;
    let skippedConfigurationCount = ordersWithoutCourier.length;
    let batchCount = 0;
    const detailMessages: string[] = [];
    const stockWarnings: string[] = [];

    if (ordersWithoutCourier.length) {
      detailMessages.push(
        `${ordersWithoutCourier.length} order(s) have no courier assigned.`
      );
    }

    for (const courierSlug of courierSlugs) {
      const courier = courierBySlug.get(courierSlug);
      const courierOrders = orders.filter((order) => order.courier === courierSlug);

      if (!courier) {
        skippedConfigurationCount += courierOrders.length;
        detailMessages.push(
          `${courierSlug}: ${courierOrders.length} order(s) skipped because the courier is inactive or missing.`
        );
        continue;
      }

      if (!courier.pathaoEnabled || !courier.pathaoStoreId) {
        skippedConfigurationCount += courierOrders.length;
        detailMessages.push(
          `${courier.name}: ${courierOrders.length} order(s) skipped because Pathao API/Store ID is not configured.`
        );
        continue;
      }

      const alreadyPathao = courierOrders.filter(
        (order) =>
          Boolean(order.pathaoConsignmentId) ||
          ["SUBMITTING", "SUBMITTED", "CONSIGNMENT_CREATED"].includes(
            order.pathaoSubmissionStatus
          )
      );
      alreadySubmittedCount += alreadyPathao.length;

      const candidates = courierOrders.filter(
        (order) =>
          !order.pathaoConsignmentId &&
          !["SUBMITTING", "SUBMITTED", "CONSIGNMENT_CREATED"].includes(
            order.pathaoSubmissionStatus
          )
      );

      const validPrepared: PreparedPathaoOrder[] = [];
      const invalidRows: { id: string; invoice: string; error: string }[] = [];

      for (const order of candidates) {
        const errors = validatePathaoOrder(order);
        if (errors.length) {
          invalidRows.push({
            id: order.id,
            invoice: order.invoiceId || order.orderId || order.id,
            error: errors.join(" "),
          });
          continue;
        }

        validPrepared.push(preparePathaoOrder(order, courier.pathaoStoreId));
      }

      invalidCount += invalidRows.length;

      for (const row of invalidRows) {
        await prisma.order.update({
          where: { id: row.id },
          data: {
            pathaoCourierId: courier.id,
            pathaoSubmissionStatus: "FAILED",
            pathaoLastError: row.error,
          },
        });
      }

      if (invalidRows.length) {
        detailMessages.push(
          `${courier.name}: ${invalidRows.length} invalid order(s) remain in Non CSV.`
        );
      }

      for (const preparedChunk of chunkArray(
        validPrepared,
        PUSH_ALL_CHUNK_SIZE
      )) {
        const claimedPrepared: PreparedPathaoOrder[] = [];

        // Claim each order independently. This avoids one agent/button click
        // interfering with another concurrent submission of a different order.
        for (const preparedOrder of preparedChunk) {
          const claimed = await prisma.order.updateMany({
            where: {
              id: preparedOrder.orderId,
              csvDownloaded: false,
              pathaoSubmissionStatus: { in: ["NOT_SUBMITTED", "FAILED"] },
              pathaoConsignmentId: null,
            },
            data: {
              pathaoCourierId: courier.id,
              pathaoSubmissionStatus: "SUBMITTING",
              pathaoMerchantOrderId: null,
              pathaoLastError: null,
            },
          });

          if (claimed.count === 1) {
            claimedPrepared.push(preparedOrder);
          } else {
            alreadySubmittedCount += 1;
          }
        }

        if (!claimedPrepared.length) continue;

        const preparedIds = claimedPrepared.map((row) => row.orderId);

        let pathaoResponse;
        try {
          pathaoResponse = await createPathaoBulkOrders(
            courier.id,
            claimedPrepared.map((row) => row.payload)
          );

          if (
            Number(pathaoResponse.code || 202) !== 202 ||
            pathaoResponse.data !== true
          ) {
            throw new Error(
              pathaoResponse.message ||
                "Pathao did not accept the bulk order request."
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Pathao bulk submission failed.";

          await prisma.order.updateMany({
            where: {
              id: { in: preparedIds },
              pathaoSubmissionStatus: "SUBMITTING",
              pathaoCourierId: courier.id,
            },
            data: {
              pathaoSubmissionStatus: "FAILED",
              pathaoLastError: errorMessage,
              pathaoRawResponse: errorMessage,
            },
          });

          failedCount += preparedIds.length;
          detailMessages.push(
            `${courier.name}: ${preparedIds.length} order(s) failed — ${errorMessage}`
          );
          continue;
        }

        const submittedAt = new Date();
        const batchNo = makePushAllBatchNo();

        await prisma.$transaction(async (tx) => {
          const batch = await tx.csvBatch.create({
            data: {
              batchNo,
              courier: courierSlug,
              totalOrders: preparedIds.length,
              createdByUserId: session.user.id,
            },
          });

          await tx.csvBatchItem.createMany({
            data: preparedIds.map((orderId) => ({
              batchId: batch.id,
              orderId,
            })),
          });

          for (const preparedOrder of claimedPrepared) {
            await tx.order.update({
              where: { id: preparedOrder.orderId },
              data: {
                csvDownloaded: true,
                pathaoCourierId: courier.id,
                pathaoMerchantOrderId: preparedOrder.invoiceId,
                pathaoSubmissionStatus: "SUBMITTED",
                pathaoSubmittedAt: submittedAt,
                pathaoAmountToCollect: preparedOrder.payload.amount_to_collect,
                pathaoLastSyncedAt: submittedAt,
                pathaoLastError: null,
                pathaoRawResponse: JSON.stringify(pathaoResponse),
              },
            });

            await tx.orderAuditEvent.create({
              data: {
                orderId: preparedOrder.orderId,
                eventType: "PATHAO_PUSH_ALL",
                title: "Pushed to assigned Pathao courier",
                details: {
                  courierId: courier.id,
                  courierName: courier.name,
                  courierSlug,
                  batchNo,
                  merchantOrderId: preparedOrder.invoiceId,
                },
                performedByUserId: session.user.id,
                actorLabel: session.user.name || session.user.username || "OMS user",
              },
            });

            const inventory = await applyInventorySaleForOrderTx(
              tx,
              preparedOrder.orderId,
              session.user.id
            );
            stockWarnings.push(...inventory.warnings);
          }
        }, { timeout: 30_000 });

        submittedCount += preparedIds.length;
        batchCount += 1;
      }
    }

    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/pathao-orders");
    revalidatePath("/dashboard/stock-control");
    revalidatePath("/dashboard/products");

    const summary = [
      `${submittedCount} submitted`,
      `${batchCount} courier batch${batchCount === 1 ? "" : "es"}`,
      invalidCount ? `${invalidCount} invalid` : "",
      alreadySubmittedCount ? `${alreadySubmittedCount} already submitted` : "",
      skippedConfigurationCount
        ? `${skippedConfigurationCount} skipped/unconfigured`
        : "",
      failedCount ? `${failedCount} failed` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (stockWarnings.length) {
      detailMessages.push(
        `Stock warning: ${[...new Set(stockWarnings)].slice(0, 5).join(" ")}`
      );
    }

    const details = detailMessages.slice(0, 6).join(" ");

    return {
      success: submittedCount > 0 && failedCount === 0,
      message:
        submittedCount > 0
          ? `Push All finished: ${summary}.${details ? ` ${details}` : ""}`
          : `Nothing was submitted. ${summary}.${details ? ` ${details}` : ""}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to push orders to assigned couriers.",
    };
  }
}

