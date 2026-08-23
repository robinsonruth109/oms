"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getPathaoOrderInfo } from "@/lib/pathao/client";

type ActionState = { success: boolean; message: string };

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
}

export async function refreshPathaoOrder(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAccess();
    const { prisma } = await import("@/lib/prisma");

    const orderId = String(formData.get("orderId") || "").trim();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return { success: false, message: "OMS order not found." };
    if (!order.pathaoCourierId) {
      return { success: false, message: "Order is not linked to a Pathao courier." };
    }
    if (!order.pathaoConsignmentId) {
      return {
        success: false,
        message:
          "Consignment ID has not arrived yet. Wait for Pathao webhook/order creation.",
      };
    }

    const info = await getPathaoOrderInfo(
      order.pathaoCourierId,
      order.pathaoConsignmentId
    );

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
        pathaoLastError: null,
        pathaoRawResponse: JSON.stringify(info),
      },
    });

    revalidatePath("/dashboard/pathao-orders");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: `Pathao status refreshed: ${
        info.order_status || info.order_status_slug || "Updated"
      }.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to refresh Pathao order.",
    };
  }
}
