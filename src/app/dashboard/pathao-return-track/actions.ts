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

export type ReturnSelectionItem = {
  orderItemId: string;
  productSku: string;
  productName: string;
  orderedQty: number;
  alreadyReturnedQty: number;
  remainingQty: number;
};

export type ReturnLookupPayload = {
  consignmentId: string;
  pathaoCourierId: string;
  pathaoCourierName: string;
  merchantOrderId: string;
  pathaoStatus: string | null;
  pathaoStatusSlug: string | null;
  order: {
    id: string;
    invoiceId: string;
    customerName: string;
    phone: string;
    orderStatus: string;
    outboundConsignmentId: string | null;
    items: ReturnSelectionItem[];
  };
};

export type ScanReturnResult =
  | {
      success: true;
      action: "PROCESSED";
      message: string;
      processed: {
        invoiceId: string;
        consignmentId: string;
        returnType: "FULL" | "PARTIAL";
        omsStatus: string;
        pathaoStatus: string | null;
        restoredQty: number;
      };
    }
  | {
      success: true;
      action: "NEEDS_ITEM_SELECTION";
      message: string;
      lookup: ReturnLookupPayload;
    }
  | {
      success: false;
      action: "ERROR" | "ALREADY_PROCESSED" | "ALREADY_RETURNED";
      message: string;
    };

type SelectedItemInput = {
  orderItemId: string;
  returnedQty: number;
};

type ProcessSelectedInput = {
  consignmentId: string;
  pathaoCourierId: string;
  orderId: string;
  selectedItems: SelectedItemInput[];
};

type SessionUser = {
  id: string;
  name?: string | null;
  username?: string | null;
};

class ReturnProcessError extends Error {
  code: "ALREADY_PROCESSED" | "ALREADY_RETURNED" | "ERROR";

  constructor(
    code: "ALREADY_PROCESSED" | "ALREADY_RETURNED" | "ERROR",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

async function requireReturnAccess() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    throw new ReturnProcessError("ERROR", "Unauthorized action.");
  }

  return session;
}

function normalizeConsignmentId(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code || "") === "P2002"
  );
}

async function returnedQtyByOrderItem(orderItemIds: string[]) {
  if (!orderItemIds.length) return new Map<string, number>();

  const rows = await prisma.pathaoReturnItem.groupBy({
    by: ["orderItemId"],
    where: { orderItemId: { in: orderItemIds } },
    _sum: { returnedQty: true },
  });

  return new Map(
    rows.map((row) => [row.orderItemId, Number(row._sum.returnedQty || 0)])
  );
}

function serializeRawInfo(info: unknown) {
  return JSON.parse(JSON.stringify(info ?? {})) as Prisma.InputJsonValue;
}

async function processReturn({
  consignmentId,
  match,
  orderId,
  selectedItems,
  user,
  method,
}: {
  consignmentId: string;
  match: PathaoReturnCourierMatch;
  orderId: string;
  selectedItems: SelectedItemInput[];
  user: SessionUser;
  method: "AUTO" | "ITEM_SELECTION";
}): Promise<Extract<ScanReturnResult, { action: "PROCESSED" }>> {
  const cleanSelected = selectedItems
    .map((item) => ({
      orderItemId: String(item.orderItemId || "").trim(),
      returnedQty: Math.trunc(Number(item.returnedQty || 0)),
    }))
    .filter((item) => item.orderItemId && item.returnedQty > 0);

  if (!cleanSelected.length) {
    throw new ReturnProcessError(
      "ERROR",
      "Select at least one returned product and quantity."
    );
  }

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.pathaoReturnTrack.findUnique({
        where: { returnConsignmentId: consignmentId },
        include: { processedByUser: { select: { name: true, username: true } } },
      });

      if (duplicate) {
        throw new ReturnProcessError(
          "ALREADY_PROCESSED",
          `Return consignment ${consignmentId} was already processed by ${
            duplicate.processedByUser.name || duplicate.processedByUser.username
          }.`
        );
      }

      // Updating the row first serializes concurrent return scans for the same
      // order so cumulative returned quantities cannot race each other.
      await tx.order.update({
        where: { id: orderId },
        data: { updatedAt: new Date() },
      });

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order || !order.invoiceId) {
        throw new ReturnProcessError("ERROR", "OMS order was not found.");
      }

      const outboundConsignmentId =
        match.outboundConsignmentId || order.pathaoConsignmentId;

      if (order.invoiceId !== match.merchantOrderId) {
        throw new ReturnProcessError(
          "ERROR",
          "Pathao merchant order ID does not match this OMS invoice."
        );
      }

      if (outboundConsignmentId === consignmentId) {
        throw new ReturnProcessError(
          "ERROR",
          "This is the original outbound consignment ID, not a return consignment ID."
        );
      }

      if (order.orderStatus === "RETURNED") {
        throw new ReturnProcessError(
          "ALREADY_RETURNED",
          `Invoice ${order.invoiceId} is already fully returned.`
        );
      }

      const itemIds = order.items.map((item) => item.id);
      const previousRows = itemIds.length
        ? await tx.pathaoReturnItem.groupBy({
            by: ["orderItemId"],
            where: { orderItemId: { in: itemIds } },
            _sum: { returnedQty: true },
          })
        : [];
      const previousMap = new Map(
        previousRows.map((row) => [
          row.orderItemId,
          Number(row._sum.returnedQty || 0),
        ])
      );

      const orderItemMap = new Map(order.items.map((item) => [item.id, item]));
      const selectedMap = new Map<string, number>();

      for (const selected of cleanSelected) {
        const item = orderItemMap.get(selected.orderItemId);
        if (!item) {
          throw new ReturnProcessError(
            "ERROR",
            "One of the selected order products no longer exists."
          );
        }

        const alreadyReturned = previousMap.get(item.id) || 0;
        const remaining = Math.max(0, item.quantity - alreadyReturned);

        if (selected.returnedQty > remaining) {
          throw new ReturnProcessError(
            "ERROR",
            `${item.productSku} can return maximum ${remaining} more piece(s).`
          );
        }

        selectedMap.set(
          item.id,
          (selectedMap.get(item.id) || 0) + selected.returnedQty
        );
      }

      const isFullReturn = order.items.every((item) => {
        const before = previousMap.get(item.id) || 0;
        const now = selectedMap.get(item.id) || 0;
        return before + now >= item.quantity;
      });

      const newOmsStatus = isFullReturn ? "RETURNED" : "PARTIAL_RETURN";
      const totalRestoredQty = [...selectedMap.values()].reduce(
        (sum, qty) => sum + qty,
        0
      );

      const track = await tx.pathaoReturnTrack.create({
        data: {
          returnConsignmentId: consignmentId,
          outboundConsignmentId,
          merchantOrderId: order.invoiceId,
          orderId: order.id,
          pathaoCourierId: match.courierId,
          pathaoOrderStatus: match.pathaoStatus,
          pathaoOrderStatusSlug: match.pathaoStatusSlug,
          previousOmsStatus: order.orderStatus,
          newOmsStatus,
          returnType: isFullReturn ? "FULL" : "PARTIAL",
          totalRestoredQty,
          processingMethod: method,
          rawPathaoResponse: serializeRawInfo(match.info),
          processedByUserId: user.id,
        },
      });

      const restoredItems: {
        sku: string;
        name: string;
        quantity: number;
      }[] = [];

      for (const [orderItemId, returnedQty] of selectedMap) {
        const item = orderItemMap.get(orderItemId)!;

        let product = item.productId
          ? await tx.product.findUnique({ where: { id: item.productId } })
          : null;

        if (!product) {
          product = await tx.product.findUnique({
            where: { sku: item.productSku },
          });
        }

        if (!product) {
          throw new ReturnProcessError(
            "ERROR",
            `Product ${item.productSku} is not linked to Product Master, so stock cannot be restored safely.`
          );
        }

        const stockBefore = product.quantity;
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: {
            quantity: { increment: returnedQty },
          },
          select: { quantity: true },
        });

        await tx.pathaoReturnItem.create({
          data: {
            returnTrackId: track.id,
            orderItemId: item.id,
            productId: product.id,
            productSkuSnapshot: item.productSku,
            productNameSnapshot: item.productName,
            orderedQty: item.quantity,
            returnedQty,
            stockBefore,
            stockAfter: updatedProduct.quantity,
          },
        });

        restoredItems.push({
          sku: item.productSku,
          name: item.productName,
          quantity: returnedQty,
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus: newOmsStatus },
      });

      await tx.orderAuditEvent.create({
        data: {
          orderId: order.id,
          eventType: isFullReturn ? "PATHAO_RETURNED" : "PATHAO_PARTIAL_RETURN",
          title: isFullReturn
            ? "Pathao return processed"
            : "Pathao partial return processed",
          performedByUserId: user.id,
          actorLabel: user.name || user.username || "OMS User",
          details: {
            returnConsignmentId: consignmentId,
            outboundConsignmentId,
            merchantOrderId: order.invoiceId,
            pathaoCourier: match.courierName,
            pathaoStatus: match.pathaoStatus,
            pathaoStatusSlug: match.pathaoStatusSlug,
            previousStatus: order.orderStatus,
            newStatus: newOmsStatus,
            restoredItems,
            totalRestoredQty,
          },
        },
      });

      return {
        invoiceId: order.invoiceId,
        returnType: isFullReturn ? ("FULL" as const) : ("PARTIAL" as const),
        omsStatus: newOmsStatus,
        restoredQty: totalRestoredQty,
      };
    });

    revalidatePath("/dashboard/pathao-return-track");
    revalidatePath("/dashboard/all-orders");
    revalidatePath(`/dashboard/all-orders/${orderId}`);
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/product-report");
    revalidatePath("/dashboard/pathao-daily-report");
    revalidatePath("/dashboard");

    return {
      success: true,
      action: "PROCESSED",
      message: `${transactionResult.returnType === "FULL" ? "Full" : "Partial"} return processed for ${transactionResult.invoiceId}. Stock restored: ${transactionResult.restoredQty} pcs.`,
      processed: {
        invoiceId: transactionResult.invoiceId,
        consignmentId,
        returnType: transactionResult.returnType,
        omsStatus: transactionResult.omsStatus,
        pathaoStatus: match.pathaoStatus,
        restoredQty: transactionResult.restoredQty,
      },
    };
  } catch (error) {
    if (error instanceof ReturnProcessError) throw error;

    if (isUniqueConstraintError(error)) {
      throw new ReturnProcessError(
        "ALREADY_PROCESSED",
        `Return consignment ${consignmentId} has already been processed.`
      );
    }

    throw error;
  }
}

function errorResult(error: unknown): ScanReturnResult {
  if (error instanceof ReturnProcessError) {
    return {
      success: false,
      action: error.code,
      message: error.message,
    };
  }

  return {
    success: false,
    action: "ERROR",
    message:
      error instanceof Error ? error.message : "Failed to process Pathao return.",
  };
}

export async function scanPathaoReturnAction(
  rawConsignmentId: string
): Promise<ScanReturnResult> {
  try {
    const session = await requireReturnAccess();
    const consignmentId = normalizeConsignmentId(rawConsignmentId);

    if (!consignmentId) {
      throw new ReturnProcessError("ERROR", "Consignment ID is required.");
    }

    const alreadyProcessed = await prisma.pathaoReturnTrack.findUnique({
      where: { returnConsignmentId: consignmentId },
      include: {
        order: { select: { invoiceId: true } },
        processedByUser: { select: { name: true, username: true } },
      },
    });

    if (alreadyProcessed) {
      return {
        success: false,
        action: "ALREADY_PROCESSED",
        message: `${consignmentId} is already processed for invoice ${
          alreadyProcessed.order.invoiceId || alreadyProcessed.merchantOrderId
        } by ${
          alreadyProcessed.processedByUser.name ||
          alreadyProcessed.processedByUser.username
        }. No stock was changed.`,
      };
    }

    const search = await searchAllPathaoCouriersForConsignment(consignmentId);

    if (!search.checkedCourierCount) {
      throw new ReturnProcessError(
        "ERROR",
        "No active Pathao courier account is configured in OMS."
      );
    }

    if (!search.matches.length) {
      const failedAccounts = search.errors.filter(
        (row) => !/\(404\)/.test(row.message)
      );
      const suffix = failedAccounts.length
        ? ` ${failedAccounts.length} Pathao account(s) could not be checked successfully.`
        : "";

      throw new ReturnProcessError(
        "ERROR",
        `Return consignment ${consignmentId} could not be matched. OMS checked verified Pathao return-webhook history first, then all configured Pathao courier accounts.${suffix} If this is an RG return ID, confirm Pathao return lifecycle webhooks are enabled for that courier account.`
      );
    }

    const merchantIds = [...new Set(search.matches.map((match) => match.merchantOrderId))];
    const orders = await prisma.order.findMany({
      where: { invoiceId: { in: merchantIds } },
      include: { items: true },
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
      throw new ReturnProcessError(
        "ERROR",
        `Pathao found consignment ${consignmentId}, but OMS invoice ${merchantIds.join(
          ", "
        )} was not found.`
      );
    }

    const order = orderByInvoice.get(match.merchantOrderId)!;

    if (!order.invoiceId) {
      throw new ReturnProcessError("ERROR", "Matched OMS order has no invoice ID.");
    }

    const resolvedOutboundConsignmentId =
      match.outboundConsignmentId || order.pathaoConsignmentId;

    // Repair a previously overwritten outbound ID when verified Pathao webhook
    // history gives us the original outbound consignment.
    if (
      match.source === "RETURN_WEBHOOK" &&
      resolvedOutboundConsignmentId &&
      order.pathaoConsignmentId !== resolvedOutboundConsignmentId
    ) {
      await prisma.order.update({
        where: { id: order.id },
        data: { pathaoConsignmentId: resolvedOutboundConsignmentId },
      });
    }

    if (
      resolvedOutboundConsignmentId === consignmentId ||
      match.source === "ORDER_INFO"
    ) {
      throw new ReturnProcessError(
        "ERROR",
        "This barcode is the original outbound Pathao consignment ID. Scan the return consignment ID instead."
      );
    }

    if (order.orderStatus === "RETURNED") {
      return {
        success: false,
        action: "ALREADY_RETURNED",
        message: `Invoice ${order.invoiceId} is already Returned. No stock was changed.`,
      };
    }

    const previousMap = await returnedQtyByOrderItem(
      order.items.map((item) => item.id)
    );

    const selectionItems: ReturnSelectionItem[] = order.items.map((item) => {
      const alreadyReturnedQty = previousMap.get(item.id) || 0;
      return {
        orderItemId: item.id,
        productSku: item.productSku,
        productName: item.productName,
        orderedQty: item.quantity,
        alreadyReturnedQty,
        remainingQty: Math.max(0, item.quantity - alreadyReturnedQty),
      };
    });

    if (selectionItems.every((item) => item.remainingQty <= 0)) {
      return {
        success: false,
        action: "ALREADY_RETURNED",
        message: `All products of invoice ${order.invoiceId} were already returned. No stock was changed.`,
      };
    }

    const needsItemSelection =
      order.items.length > 1 || order.items.some((item) => item.quantity > 1);

    if (!needsItemSelection) {
      const item = selectionItems[0];
      return await processReturn({
        consignmentId,
        match,
        orderId: order.id,
        selectedItems: [{ orderItemId: item.orderItemId, returnedQty: 1 }],
        user: session.user,
        method: "AUTO",
      });
    }

    return {
      success: true,
      action: "NEEDS_ITEM_SELECTION",
      message: `Invoice ${order.invoiceId} has multiple products or quantity. Select the physically returned item(s).`,
      lookup: {
        consignmentId,
        pathaoCourierId: match.courierId,
        pathaoCourierName: match.courierName,
        merchantOrderId: match.merchantOrderId,
        pathaoStatus: match.pathaoStatus,
        pathaoStatusSlug: match.pathaoStatusSlug,
        order: {
          id: order.id,
          invoiceId: order.invoiceId,
          customerName: order.customerName,
          phone: order.phone,
          orderStatus: order.orderStatus,
          outboundConsignmentId: resolvedOutboundConsignmentId,
          items: selectionItems,
        },
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function processSelectedPathaoReturnAction(
  payload: ProcessSelectedInput
): Promise<ScanReturnResult> {
  try {
    const session = await requireReturnAccess();
    const consignmentId = normalizeConsignmentId(payload.consignmentId);
    const courierId = String(payload.pathaoCourierId || "").trim();
    const orderId = String(payload.orderId || "").trim();

    if (!consignmentId || !courierId || !orderId) {
      throw new ReturnProcessError("ERROR", "Return selection data is incomplete.");
    }

    const [courier, order] = await Promise.all([
      prisma.courier.findFirst({
        where: { id: courierId, status: true, pathaoEnabled: true },
        select: { id: true, name: true, slug: true },
      }),
      prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, invoiceId: true },
      }),
    ]);

    if (!courier) {
      throw new ReturnProcessError("ERROR", "Matched Pathao courier is no longer active.");
    }

    if (!order?.invoiceId) {
      throw new ReturnProcessError("ERROR", "OMS order was not found.");
    }

    const search = await searchAllPathaoCouriersForConsignment(consignmentId);
    const match = search.matches.find(
      (candidate) =>
        candidate.courierId === courier.id &&
        candidate.merchantOrderId === order.invoiceId
    );

    if (!match) {
      throw new ReturnProcessError(
        "ERROR",
        "Pathao return consignment no longer matches this OMS invoice."
      );
    }

    return await processReturn({
      consignmentId,
      match,
      orderId,
      selectedItems: payload.selectedItems || [],
      user: session.user,
      method: "ITEM_SELECTION",
    });
  } catch (error) {
    return errorResult(error);
  }
}
