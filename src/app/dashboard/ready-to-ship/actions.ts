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
import {
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
      }

      return createdBatch;
    });

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
