"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getPathaoOrderInfo } from "@/lib/pathao/client";
import { extractPathaoAmountToCollect } from "@/lib/pathao/order-info";

export type PathaoProblemActionState = {
  success: boolean;
  message: string;
};

async function requirePathaoProblemAccess() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "NOTE_AGENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return session;
}

function readMoney(value: FormDataEntryValue | null) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  const amount = Number(normalized);

  if (!normalized || !Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid non-negative COD amount.");
  }

  return Math.round(amount * 100) / 100;
}

export async function authorizePathaoCod(
  _prevState: PathaoProblemActionState,
  formData: FormData
): Promise<PathaoProblemActionState> {
  try {
    const session = await requirePathaoProblemAccess();
    const { prisma } = await import("@/lib/prisma");

    const orderId = String(formData.get("orderId") || "").trim();
    const authorizedAmount = readMoney(formData.get("authorizedAmount"));
    const reason = String(formData.get("reason") || "").trim();

    if (reason.length < 3) {
      return {
        success: false,
        message: "Please enter a reason/note for the COD authorization.",
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, message: "OMS order not found." };
    }

    if (!order.pathaoConsignmentId) {
      return {
        success: false,
        message:
          "This order has no Pathao consignment ID yet. COD authorization is only available for a created Pathao parcel.",
      };
    }

    if (!order.pathaoCourierId) {
      return {
        success: false,
        message: "This order is not linked to a Pathao courier.",
      };
    }

    const originalTotal = Number(order.totalAmount);
    const previousAuthorized =
      order.pathaoAuthorizedCodAmount === null
        ? null
        : Number(order.pathaoAuthorizedCodAmount);

    await prisma.$transaction(async (tx) => {
      await tx.pathaoCodAuthorization.create({
        data: {
          orderId: order.id,
          originalOmsTotal: originalTotal,
          previousAuthorizedAmount: previousAuthorized,
          authorizedAmount,
          pathaoAmountAtApproval:
            order.pathaoAmountToCollect === null
              ? null
              : Number(order.pathaoAmountToCollect),
          reason,
          approvedByUserId: session.user.id,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          pathaoAuthorizedCodAmount: authorizedAmount,
          pathaoCodAdjustmentReason: reason,
          pathaoCodApprovedByUserId: session.user.id,
          pathaoCodApprovedAt: new Date(),
        },
      });
    });

    revalidatePath("/dashboard/pathao-problem");

    return {
      success: true,
      message: `Authorized Pathao COD ৳${authorizedAmount.toFixed(
        2
      )}. Now open the parcel in Pathao and change Amount to Collect to this approved value.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to authorize Pathao COD.",
    };
  }
}

export async function clearPathaoCodAuthorization(
  _prevState: PathaoProblemActionState,
  formData: FormData
): Promise<PathaoProblemActionState> {
  try {
    await requirePathaoProblemAccess();
    const { prisma } = await import("@/lib/prisma");
    const orderId = String(formData.get("orderId") || "").trim();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, message: "OMS order not found." };
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        pathaoAuthorizedCodAmount: null,
        pathaoCodAdjustmentReason: null,
        pathaoCodApprovedByUserId: null,
        pathaoCodApprovedAt: null,
      },
    });

    revalidatePath("/dashboard/pathao-problem");

    return {
      success: true,
      message:
        "Current COD authorization cleared. Previous authorization history remains stored.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to clear authorization.",
    };
  }
}

export async function refreshPathaoProblemOrder(
  _prevState: PathaoProblemActionState,
  formData: FormData
): Promise<PathaoProblemActionState> {
  try {
    await requirePathaoProblemAccess();
    const { prisma } = await import("@/lib/prisma");

    const orderId = String(formData.get("orderId") || "").trim();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, message: "OMS order not found." };
    }

    if (!order.pathaoCourierId || !order.pathaoConsignmentId) {
      return {
        success: false,
        message: "Pathao courier/consignment ID is missing.",
      };
    }

    const info = await getPathaoOrderInfo(
      order.pathaoCourierId,
      order.pathaoConsignmentId
    );

    const amountToCollect = extractPathaoAmountToCollect(info);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        pathaoMerchantOrderId:
          info.merchant_order_id || order.pathaoMerchantOrderId,
        pathaoOrderStatus: info.order_status || order.pathaoOrderStatus,
        pathaoOrderStatusSlug:
          info.order_status_slug || order.pathaoOrderStatusSlug,
        pathaoAmountToCollect:
          amountToCollect ?? order.pathaoAmountToCollect,
        pathaoSubmissionStatus: "CONSIGNMENT_CREATED",
        pathaoLastSyncedAt: new Date(),
        pathaoLastError: null,
        pathaoRawResponse: JSON.stringify(info),
      },
    });

    revalidatePath("/dashboard/pathao-problem");
    revalidatePath("/dashboard/pathao-orders");

    return {
      success: true,
      message:
        amountToCollect === null
          ? "Pathao status refreshed. This API response did not include Amount to Collect, so the previously stored amount was kept."
          : `Pathao refreshed. Current Amount to Collect: ৳${amountToCollect.toFixed(
              2
            )}.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to refresh Pathao parcel.",
    };
  }
}
