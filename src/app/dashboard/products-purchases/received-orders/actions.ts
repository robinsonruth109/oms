"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    await prisma.purchaseReceivedOrder.create({
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

    const finalReceivedQty = alreadyReceivedQty + receivedQty;

    await prisma.purchaseOrder.update({
      where: {
        id: purchaseOrderId,
      },
      data: {
        status:
          finalReceivedQty >= Number(purchaseOrder.quantity)
            ? "RECEIVED"
            : "PARTIAL_RECEIVED",
      },
    });

    revalidatePath(
      "/dashboard/products-purchases/received-orders"
    );

    revalidatePath(
      `/dashboard/products-purchases/purchase-orders/${purchaseOrderId}`
    );

    return {
      success: true,
      message: "Received order saved successfully.",
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