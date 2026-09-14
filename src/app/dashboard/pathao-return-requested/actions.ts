"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getPathaoOrderInfo } from "@/lib/pathao/client";
import { extractPathaoAmountToCollect } from "@/lib/pathao/order-info";

export type ReturnRequestedActionState = {
  success: boolean;
  message: string;
};

const ALLOWED_ROLES = ["ADMIN", "AGENT", "NOTE_AGENT", "PACKAGING_AGENT"];

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function refreshReturnRequestedOrder(
  _prevState: ReturnRequestedActionState,
  formData: FormData
): Promise<ReturnRequestedActionState> {
  try {
    await requireAccess();
    const { prisma } = await import("@/lib/prisma");
    const orderId = String(formData.get("orderId") || "").trim();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, message: "OMS order not found." };
    if (!order.pathaoCourierId || !order.pathaoConsignmentId) {
      return {
        success: false,
        message: "This order is missing its Pathao courier or consignment ID.",
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
        pathaoSubmissionStatus: "CONSIGNMENT_CREATED",
        pathaoLastSyncedAt: new Date(),
        pathaoAmountToCollect:
          amountToCollect ?? order.pathaoAmountToCollect,
        pathaoLastError: null,
        pathaoRawResponse: JSON.stringify(info),
      },
    });

    revalidatePath("/dashboard/pathao-return-requested");
    revalidatePath("/dashboard/pathao-orders");

    return {
      success: true,
      message: `Pathao refreshed: ${
        info.order_status || info.order_status_slug || "Updated"
      }.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to refresh Pathao status.",
    };
  }
}

export async function markPathaoReattemptRequested(
  _prevState: ReturnRequestedActionState,
  formData: FormData
): Promise<ReturnRequestedActionState> {
  try {
    const session = await requireAccess();
    const { prisma } = await import("@/lib/prisma");
    const orderId = String(formData.get("orderId") || "").trim();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        invoiceId: true,
        orderId: true,
        pathaoConsignmentId: true,
        pathaoOrderStatus: true,
        pathaoOrderStatusSlug: true,
        pathaoCourier: { select: { name: true } },
      },
    });

    if (!order) return { success: false, message: "OMS order not found." };
    if (!order.pathaoConsignmentId) {
      return { success: false, message: "Pathao consignment ID is missing." };
    }

    const recent = await prisma.orderAuditEvent.findFirst({
      where: {
        orderId: order.id,
        eventType: "PATHAO_REATTEMPT_REQUESTED",
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      return {
        success: true,
        message: "This parcel was already marked as reattempt requested in OMS recently.",
      };
    }

    await prisma.orderAuditEvent.create({
      data: {
        orderId: order.id,
        eventType: "PATHAO_REATTEMPT_REQUESTED",
        title: "Pathao reattempt requested manually",
        details: {
          invoiceId: order.invoiceId || order.orderId,
          consignmentId: order.pathaoConsignmentId,
          courier: order.pathaoCourier?.name || null,
          pathaoStatus: order.pathaoOrderStatus,
          pathaoStatusSlug: order.pathaoOrderStatusSlug,
          note:
            "User confirmed that the reattempt request was submitted manually in Pathao Merchant Panel.",
        },
        performedByUserId: session.user.id,
        actorLabel: session.user.name || session.user.username || session.user.role,
      },
    });

    revalidatePath("/dashboard/pathao-return-requested");

    return {
      success: true,
      message: "Marked in OMS as reattempt requested. Refresh Pathao after its status changes.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save reattempt log.",
    };
  }
}
