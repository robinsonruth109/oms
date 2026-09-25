"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "@/lib/inventory";

type CreateReceivedOrderInput = {
  purchaseOrderId: string;
  receiveDate: string;
  receivedQty: number;
  packageWeight: number;
  cnfRatePerKg: number;
  otherCostBdt: number;
  note?: string;
};

type ActionResult = {
  success: boolean;
  message: string;
};

function toNumber(value: unknown) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

export async function createReceivedOrder(
  payload: CreateReceivedOrderInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const purchaseOrderId = String(payload.purchaseOrderId || "").trim();

  const receiveDate = String(payload.receiveDate || "").trim();

  const receivedQty = toNumber(payload.receivedQty);

  const packageWeight = toNumber(payload.packageWeight);

  const cnfRatePerKg = toNumber(payload.cnfRatePerKg);

  const otherCostBdt = toNumber(payload.otherCostBdt);

  const note = String(payload.note || "").trim();

  if (!purchaseOrderId) {
    return {
      success: false,
      message: "Purchase order ID is required.",
    };
  }

  if (!receiveDate) {
    return {
      success: false,
      message: "Receive date is required.",
    };
  }

  if (receivedQty <= 0) {
    return {
      success: false,
      message: "Received quantity must be greater than 0.",
    };
  }

  try {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: {
        id: purchaseOrderId,
      },
      include: {
        payments: true,
        receivedOrders: true,
      },
    });

    if (!purchaseOrder) {
      return {
        success: false,
        message: "Purchase order not found.",
      };
    }

    const totalPaidBdt = purchaseOrder.payments.reduce(
      (sum, item) => sum + Number(item.amountBdt),
      0
    );

    if (totalPaidBdt <= 0) {
      return {
        success: false,
        message: "This order has no payment.",
      };
    }

    const alreadyReceivedQty = purchaseOrder.receivedOrders.reduce(
      (sum, item) => sum + Number(item.receivedQty),
      0
    );

    const remainingQty =
      Number(purchaseOrder.quantity) - alreadyReceivedQty;

    if (receivedQty > remainingQty) {
      return {
        success: false,
        message: `Remaining quantity is ${remainingQty}.`,
      };
    }

    const totalCnfCharge = packageWeight * cnfRatePerKg;

    const grandTotalBdt =
      totalPaidBdt + otherCostBdt + totalCnfCharge;

    const originalUnitPrice =
      receivedQty > 0 ? grandTotalBdt / receivedQty : 0;

    const finalReceivedQty = alreadyReceivedQty + receivedQty;

    const stockResult = await prisma.$transaction(async (tx) => {
      const received = await tx.purchaseReceivedOrder.create({
        data: {
          purchaseOrderId,
          receiveDate: new Date(`${receiveDate}T00:00:00`),
          receivedQty,
          packageWeight,
          cnfRatePerKg,
          totalCnfCharge,
          otherCostBdt,
          paidAmountBdt: totalPaidBdt,
          grandTotalBdt,
          unitOriginalCost: originalUnitPrice,
          note,
        },
      });

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status:
            finalReceivedQty >= Number(purchaseOrder.quantity)
              ? "RECEIVED"
              : "PARTIAL_RECEIVED",
        },
      });

      const inventory = await applyStockMovement(tx, {
        productId: purchaseOrder.productId,
        movementType: "PURCHASE_RECEIVED",
        quantityDelta: receivedQty,
        unitCost: originalUnitPrice,
        idempotencyKey: "PURCHASE_RECEIVED:" + received.id,
        referenceType: "PURCHASE_RECEIVED",
        referenceId: received.id,
        note:
          "Purchase received: " +
          receivedQty +
          " physical unit(s), weighted-average landed cost update.",
        createdByUserId: session.user.id,
      });

      return inventory;
    }, { timeout: 30_000 });

    revalidatePath(
      "/dashboard/products-purchases/received-orders"
    );
    revalidatePath("/dashboard/inventory");

    revalidatePath(
      `/dashboard/products-purchases/purchase-orders/${purchaseOrderId}`
    );

    return {
      success: true,
      message:
        "Received order saved successfully." +
        (stockResult.applied
          ? " Tracked inventory increased."
          : stockResult.reason === "TRACKING_NOT_ACTIVE"
            ? " Inventory was not changed because stock tracking is not active for this Product Parent."
            : ""),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save received order.",
    };
  }
}