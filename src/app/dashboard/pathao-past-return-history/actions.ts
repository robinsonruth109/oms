"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPathaoOrderInfo } from "@/lib/pathao/client";
import type { PathaoReturnCourierMatch } from "@/lib/pathao/return-tracking";

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


async function searchHistoricalPathaoForConsignment(consignmentId: string) {
  const normalized = normalizeConsignmentId(consignmentId);

  // 1) Exact Pathao payment-settlement history. This is already verified
  // against a Pathao account and is the strongest local historical source.
  const settlement = await prisma.pathaoSettlement.findUnique({
    where: { consignmentId: normalized },
    include: {
      upload: { select: { courierId: true, courierName: true } },
    },
  });

  const settlementOrder = settlement?.orderId
    ? await prisma.order.findUnique({
        where: { id: settlement.orderId },
        select: {
          id: true,
          invoiceId: true,
          pathaoConsignmentId: true,
          pathaoMerchantOrderId: true,
        },
      })
    : settlement?.merchantOrderId
      ? await prisma.order.findFirst({
          where: {
            OR: [
              { invoiceId: settlement.merchantOrderId },
              { pathaoMerchantOrderId: settlement.merchantOrderId },
            ],
          },
          select: {
            id: true,
            invoiceId: true,
            pathaoConsignmentId: true,
            pathaoMerchantOrderId: true,
          },
        })
      : null;

  if (settlement && settlementOrder?.invoiceId) {
    const info = {
      consignment_id: settlementOrder.pathaoConsignmentId || undefined,
      return_consignment_id: normalized,
      merchant_order_id: settlementOrder.invoiceId,
      order_status: settlement.orderStatus || undefined,
      order_status_slug: settlement.orderStatus || undefined,
    };

    return {
      checkedCourierCount: 0,
      matches: [{
        courierId: settlement.upload.courierId,
        courierName: settlement.upload.courierName,
        courierSlug: "",
        merchantOrderId: settlementOrder.invoiceId,
        pathaoStatus: settlement.orderStatus,
        pathaoStatusSlug: settlement.orderStatus,
        outboundConsignmentId: settlementOrder.pathaoConsignmentId,
        source: "ORDER_INFO" as const,
        info,
      } satisfies PathaoReturnCourierMatch],
      errors: [] as { courierId: string; courierName: string; message: string }[],
      resolutionSource: "PATHAO_SETTLEMENT",
    };
  }

  // 2) Verified webhook history. For historical reconciliation we intentionally
  // do NOT require the courier to still be active today.
  const webhook = await prisma.pathaoWebhookEvent.findFirst({
    where: {
      signatureValid: true,
      OR: [
        { returnConsignmentId: normalized },
        { consignmentId: normalized },
      ],
      orderId: { not: null },
    },
    orderBy: { receivedAt: "desc" },
    include: {
      courier: { select: { id: true, name: true, slug: true } },
      order: {
        select: {
          invoiceId: true,
          pathaoConsignmentId: true,
          pathaoMerchantOrderId: true,
        },
      },
    },
  });

  if (webhook?.order?.invoiceId) {
    const returnId =
      normalizeConsignmentId(webhook.returnConsignmentId) || normalized;
    const outbound =
      normalizeConsignmentId(webhook.order.pathaoConsignmentId) ||
      normalizeConsignmentId(webhook.consignmentId) ||
      null;

    const info = {
      consignment_id: outbound || undefined,
      return_consignment_id: returnId,
      merchant_order_id: webhook.order.invoiceId,
      order_status: webhook.eventName,
      order_status_slug: webhook.eventName,
    };

    return {
      checkedCourierCount: 0,
      matches: [{
        courierId: webhook.courier.id,
        courierName: webhook.courier.name,
        courierSlug: webhook.courier.slug,
        merchantOrderId: webhook.order.invoiceId,
        pathaoStatus: webhook.eventName,
        pathaoStatusSlug: webhook.eventName,
        outboundConsignmentId: outbound,
        source: "RETURN_WEBHOOK" as const,
        info,
      } satisfies PathaoReturnCourierMatch],
      errors: [] as { courierId: string; courierName: string; message: string }[],
      resolutionSource: "VERIFIED_WEBHOOK",
    };
  }

  // 3) Original outbound CID already stored on an OMS order.
  const directOrder = await prisma.order.findUnique({
    where: { pathaoConsignmentId: normalized },
    select: {
      invoiceId: true,
      pathaoConsignmentId: true,
      pathaoCourierId: true,
      pathaoCourier: { select: { id: true, name: true, slug: true } },
    },
  });

  if (directOrder?.invoiceId && directOrder.pathaoCourier) {
    const info = {
      consignment_id: normalized,
      merchant_order_id: directOrder.invoiceId,
    };

    return {
      checkedCourierCount: 0,
      matches: [{
        courierId: directOrder.pathaoCourier.id,
        courierName: directOrder.pathaoCourier.name,
        courierSlug: directOrder.pathaoCourier.slug,
        merchantOrderId: directOrder.invoiceId,
        pathaoStatus: null,
        pathaoStatusSlug: null,
        outboundConsignmentId: normalized,
        source: "ORDER_INFO" as const,
        info,
      } satisfies PathaoReturnCourierMatch],
      errors: [] as { courierId: string; courierName: string; message: string }[],
      resolutionSource: "OMS_OUTBOUND_CID",
    };
  }

  // 4) Live Pathao lookup. Historical imports must include inactive/legacy
  // courier accounts; active-only filtering caused old parcels to be skipped.
  const couriers = await prisma.courier.findMany({
    where: { pathaoEnabled: true },
    orderBy: [{ status: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, status: true },
  });

  const results = await Promise.all(
    couriers.map(async (courier) => {
      try {
        const info = await getPathaoOrderInfo(courier.id, normalized);
        const merchantOrderId = String(
          info?.merchant_order_id || info?.invoice_id || ""
        ).trim().replace(/^["']|["']$/g, "");

        if (!merchantOrderId) return { type: "EMPTY" as const, courier };

        return {
          type: "MATCH" as const,
          match: {
            courierId: courier.id,
            courierName: courier.name,
            courierSlug: courier.slug,
            merchantOrderId,
            pathaoStatus: info?.order_status ? String(info.order_status) : null,
            pathaoStatusSlug: info?.order_status_slug ? String(info.order_status_slug) : null,
            outboundConsignmentId: info?.consignment_id
              ? String(info.consignment_id)
              : null,
            source: "ORDER_INFO" as const,
            info,
          } satisfies PathaoReturnCourierMatch,
        };
      } catch (error) {
        return {
          type: "ERROR" as const,
          courier,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  const matches: PathaoReturnCourierMatch[] = [];
  const errors: { courierId: string; courierName: string; message: string }[] = [];

  for (const result of results) {
    if (result.type === "MATCH") matches.push(result.match);
    if (result.type === "ERROR") {
      errors.push({
        courierId: result.courier.id,
        courierName: result.courier.name,
        message: result.error,
      });
    }
  }

  return {
    checkedCourierCount: couriers.length,
    matches,
    errors,
    resolutionSource: "PATHAO_API",
  };
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

    const search = await searchHistoricalPathaoForConsignment(consignmentId);

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
      const notFoundCount = search.errors.length - hardErrors.length;
      const reason = hardErrors.length
        ? `Pathao lookup incomplete: ${hardErrors.length} account(s) failed; ${notFoundCount} account(s) returned not found.`
        : `No matching Pathao parcel was found after checking ${search.checkedCourierCount} configured Pathao account(s), including inactive historical accounts.`;

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
