"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  searchAllPathaoCouriersForConsignment,
  type PathaoReturnCourierMatch,
} from "@/lib/pathao/return-tracking";

const PROCESSING_METHOD = "PAST_HISTORY_NO_STOCK";

export type PastReturnResult = {
  consignmentId: string;
  success: boolean;
  status: "RETURN_RECEIVED" | "ALREADY_RECORDED" | "FAILED";
  message: string;
  invoiceId?: string;
  customerName?: string;
  phone?: string;
  courierName?: string;
  merchantOrderId?: string;
  outboundConsignmentId?: string | null;
  returnConsignmentId?: string | null;
};

export type PastReturnBatchResult = {
  success: boolean;
  total: number;
  passed: number;
  failed: number;
  results: PastReturnResult[];
};

function normalizeConsignmentId(value: unknown) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").toUpperCase();
}

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER", "PACKAGING_AGENT"].includes(session.user.role)) {
    throw new Error("Unauthorized action.");
  }
  return session;
}

async function saveFailure({
  consignmentId,
  reason,
  lookupStatus,
  checkedCourierCount,
  failedCourierCount,
  matchedMerchantOrderId,
  user,
}: {
  consignmentId: string;
  reason: string;
  lookupStatus: string;
  checkedCourierCount: number;
  failedCourierCount: number;
  matchedMerchantOrderId?: string | null;
  user: { id: string; name?: string | null; username?: string | null };
}) {
  await prisma.pathaoUnmatchedReturnScan.upsert({
    where: { consignmentId },
    create: {
      consignmentId,
      status: "PAST_HISTORY_FAILED",
      lookupStatus,
      reason,
      checkedCourierCount,
      failedCourierCount,
      matchedMerchantOrderId: matchedMerchantOrderId || null,
      scannedByUserId: user.id,
      scannedByName: user.name || user.username || "OMS User",
    },
    update: {
      status: "PAST_HISTORY_FAILED",
      lookupStatus,
      reason,
      checkedCourierCount,
      failedCourierCount,
      matchedMerchantOrderId: matchedMerchantOrderId || null,
      scannedByUserId: user.id,
      scannedByName: user.name || user.username || "OMS User",
      scanCount: { increment: 1 },
      lastScannedAt: new Date(),
      resolvedAt: null,
      resolvedReturnTrackId: null,
    },
  });
}

function rawInfo(
  uploadedConsignmentId: string,
  match: PathaoReturnCourierMatch
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      ...(match.info || {}),
      pastHistoryImport: true,
      uploadedConsignmentId,
      stockRestored: false,
      processingMethod: PROCESSING_METHOD,
    })
  ) as Prisma.InputJsonValue;
}

async function processOne(
  rawConsignmentId: string,
  user: { id: string; name?: string | null; username?: string | null }
): Promise<PastReturnResult> {
  const consignmentId = normalizeConsignmentId(rawConsignmentId);

  if (!consignmentId) {
    return {
      consignmentId: "",
      success: false,
      status: "FAILED",
      message: "Empty consignment ID.",
    };
  }

  if (consignmentId.length > 191) {
    return {
      consignmentId,
      success: false,
      status: "FAILED",
      message: "Consignment ID is too long.",
    };
  }

  try {
    const existingByCid = await prisma.pathaoReturnTrack.findFirst({
      where: {
        OR: [
          { returnConsignmentId: consignmentId },
          { outboundConsignmentId: consignmentId },
        ],
      },
      include: {
        order: { select: { invoiceId: true, customerName: true, phone: true } },
        pathaoCourier: { select: { name: true } },
      },
      orderBy: { processedAt: "desc" },
    });

    if (existingByCid) {
      return {
        consignmentId,
        success: true,
        status: "ALREADY_RECORDED",
        message: "This parcel already exists in Return Track. No stock was changed.",
        invoiceId: existingByCid.order.invoiceId || existingByCid.merchantOrderId,
        customerName: existingByCid.order.customerName,
        phone: existingByCid.order.phone,
        courierName: existingByCid.pathaoCourier.name,
        merchantOrderId: existingByCid.merchantOrderId,
        outboundConsignmentId: existingByCid.outboundConsignmentId,
        returnConsignmentId: existingByCid.returnConsignmentId,
      };
    }

    const search = await searchAllPathaoCouriersForConsignment(consignmentId);

    if (!search.checkedCourierCount) {
      const reason = "No active Pathao courier account is configured in OMS.";
      await saveFailure({
        consignmentId,
        reason,
        lookupStatus: "NO_PATHAO_ACCOUNT",
        checkedCourierCount: 0,
        failedCourierCount: 0,
        user,
      });
      return { consignmentId, success: false, status: "FAILED", message: reason };
    }

    if (!search.matches.length) {
      const hardErrors = search.errors.filter((row) => !/\(404\)/.test(row.message));
      const reason = hardErrors.length
        ? `Pathao lookup incomplete: ${hardErrors.length} account(s) failed to respond.`
        : "No matching Pathao parcel was found for this consignment ID.";

      await saveFailure({
        consignmentId,
        reason,
        lookupStatus: hardErrors.length ? "PATHAO_ERROR" : "NO_MATCH",
        checkedCourierCount: search.checkedCourierCount,
        failedCourierCount: hardErrors.length,
        user,
      });

      return { consignmentId, success: false, status: "FAILED", message: reason };
    }

    const merchantIds = [...new Set(search.matches.map((row) => row.merchantOrderId).filter(Boolean))];
    const orders = await prisma.order.findMany({
      where: { invoiceId: { in: merchantIds } },
      select: {
        id: true,
        invoiceId: true,
        customerName: true,
        phone: true,
        orderStatus: true,
        pathaoConsignmentId: true,
      },
    });

    const orderByInvoice = new Map(
      orders
        .filter((order) => order.invoiceId)
        .map((order) => [String(order.invoiceId), order])
    );

    const match = search.matches.find((candidate) =>
      orderByInvoice.has(candidate.merchantOrderId)
    );

    if (!match) {
      const reason =
        merchantIds.length > 0
          ? `Pathao merchant order ID(s) ${merchantIds.join(", ")} were found, but no matching OMS invoice exists.`
          : "Pathao did not return a usable merchant order ID.";

      await saveFailure({
        consignmentId,
        reason,
        lookupStatus: "OMS_INVOICE_NOT_FOUND",
        checkedCourierCount: search.checkedCourierCount,
        failedCourierCount: search.errors.length,
        matchedMerchantOrderId: merchantIds.join(", ").slice(0, 191),
        user,
      });

      return {
        consignmentId,
        success: false,
        status: "FAILED",
        message: reason,
        merchantOrderId: merchantIds.join(", "),
      };
    }

    const order = orderByInvoice.get(match.merchantOrderId)!;
    if (!order.invoiceId) {
      throw new Error("Matched OMS order has no invoice ID.");
    }

    const apiReturnCid = normalizeConsignmentId(match.info?.return_consignment_id);
    const apiOutboundCid = normalizeConsignmentId(match.info?.consignment_id);
    const outboundConsignmentId =
      normalizeConsignmentId(match.outboundConsignmentId) ||
      apiOutboundCid ||
      normalizeConsignmentId(order.pathaoConsignmentId) ||
      null;

    const returnConsignmentId =
      apiReturnCid && apiReturnCid !== outboundConsignmentId
        ? apiReturnCid
        : consignmentId;

    const existingForOrder = await prisma.pathaoReturnTrack.findFirst({
      where: { orderId: order.id },
      include: {
        pathaoCourier: { select: { name: true } },
      },
      orderBy: { processedAt: "desc" },
    });

    if (existingForOrder) {
      await prisma.pathaoUnmatchedReturnScan.updateMany({
        where: { consignmentId, status: "PAST_HISTORY_FAILED" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedReturnTrackId: existingForOrder.id,
          reason: "Historical return already exists in Return Track.",
        },
      });

      return {
        consignmentId,
        success: true,
        status: "ALREADY_RECORDED",
        message: `Invoice ${order.invoiceId} is already recorded as a received return. No stock was changed.`,
        invoiceId: order.invoiceId,
        customerName: order.customerName,
        phone: order.phone,
        courierName: existingForOrder.pathaoCourier.name,
        merchantOrderId: match.merchantOrderId,
        outboundConsignmentId: existingForOrder.outboundConsignmentId || outboundConsignmentId,
        returnConsignmentId: existingForOrder.returnConsignmentId,
      };
    }

    const actorLabel = user.name || user.username || "OMS User";

    const track = await prisma.$transaction(async (tx) => {
      const created = await tx.pathaoReturnTrack.create({
        data: {
          returnConsignmentId,
          outboundConsignmentId,
          merchantOrderId: order.invoiceId!,
          orderId: order.id,
          pathaoCourierId: match.courierId,
          pathaoOrderStatus: match.pathaoStatus,
          pathaoOrderStatusSlug: match.pathaoStatusSlug,
          previousOmsStatus: order.orderStatus,
          newOmsStatus: "RETURNED",
          returnType: "FULL",
          totalRestoredQty: 0,
          processingMethod: PROCESSING_METHOD,
          rawPathaoResponse: rawInfo(consignmentId, match),
          processedByUserId: user.id,
        },
      });

      // Historical imports intentionally NEVER call restoreReturnedStock.
      // This page records the physical return history/status only.
      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus: "RETURNED" },
      });

      await tx.orderAuditEvent.create({
        data: {
          orderId: order.id,
          eventType: "PATHAO_PAST_RETURN_RECEIVED",
          title: "Pathao past return received",
          performedByUserId: user.id,
          actorLabel,
          details: {
            uploadedConsignmentId: consignmentId,
            returnConsignmentId,
            outboundConsignmentId,
            merchantOrderId: order.invoiceId,
            courier: match.courierName,
            pathaoStatus: match.pathaoStatus,
            previousStatus: order.orderStatus,
            newStatus: "RETURNED",
            stockRestored: false,
            source: "PATHAO_PAST_RETURN_HISTORY",
          },
        },
      });

      await tx.pathaoUnmatchedReturnScan.updateMany({
        where: { consignmentId, status: "PAST_HISTORY_FAILED" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedReturnTrackId: created.id,
          reason: "Resolved by Pathao Past Return History import.",
        },
      });

      return created;
    });

    return {
      consignmentId,
      success: true,
      status: "RETURN_RECEIVED",
      message: `Invoice ${order.invoiceId} marked Return Received. Stock was NOT restored.`,
      invoiceId: order.invoiceId,
      customerName: order.customerName,
      phone: order.phone,
      courierName: match.courierName,
      merchantOrderId: match.merchantOrderId,
      outboundConsignmentId,
      returnConsignmentId: track.returnConsignmentId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process historical Pathao return.";

    try {
      await saveFailure({
        consignmentId,
        reason: message,
        lookupStatus: "PROCESSING_ERROR",
        checkedCourierCount: 0,
        failedCourierCount: 1,
        user,
      });
    } catch {
      // Preserve the original error for the row even if failure logging fails.
    }

    return {
      consignmentId,
      success: false,
      status: "FAILED",
      message,
    };
  }
}

export async function processPastReturnBatchAction(
  rawConsignmentIds: string[]
): Promise<PastReturnBatchResult> {
  const session = await requireAccess();

  const consignmentIds = [...new Set(
    (Array.isArray(rawConsignmentIds) ? rawConsignmentIds : [])
      .map(normalizeConsignmentId)
      .filter(Boolean)
  )].slice(0, 25);

  const results: PastReturnResult[] = [];

  // Keep Pathao API pressure controlled. The client sends multiple small batches.
  for (const consignmentId of consignmentIds) {
    results.push(await processOne(consignmentId, session.user));
  }

  revalidatePath("/dashboard/pathao-past-return-history");
  revalidatePath("/dashboard/pathao-return-track");
  revalidatePath("/dashboard/profit-margin");
  revalidatePath("/dashboard/all-orders");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/product-report");
  revalidatePath("/dashboard/pathao-daily-report");

  const passed = results.filter((row) => row.success).length;

  return {
    success: results.length > 0 && passed === results.length,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
