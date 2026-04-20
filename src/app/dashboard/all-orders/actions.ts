"use server";


import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type UpdateAllOrderInput = {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  discount: number;
  advance: number;
  deliveryCharge: number;
  readyToShipAt: string;
  courier: string;
  pageId?: string;
  status:
    | "PENDING_CONFIRMATION"
    | "READY_TO_SHIP"
    | "NO_ANSWER"
    | "PHONE_OFF"
    | "STOCK_OUT"
    | "CANCELLED"
    | "RETURNED"
    | "DOUBLE_ORDER";
  note?: string;
  items?: {
    orderItemId?: string;
    productId: string;
    quantity: number;
  }[] | null;
};

type ActionResult = {
  success: boolean;
  message: string;
};

type DeleteOrderState = {
  success: boolean;
  message: string;
};

function toMoney(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isNaN(num) ? 0 : num;
}

function normalizePhone(value: string) {
  return String(value || "").trim().replace(/\s+/g, "");
}

export async function updateAllOrder(
  payload: UpdateAllOrderInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const orderId = String(payload.orderId || "").trim();
  const customerName = String(payload.customerName || "").trim();
  const phone = normalizePhone(payload.phone);
  const address = String(payload.address || "").trim();
  const discount = toMoney(payload.discount);
  const advance = toMoney(payload.advance);
  const deliveryCharge = toMoney(payload.deliveryCharge);
  const readyToShipAt = String(payload.readyToShipAt || "").trim();
  const courier = String(payload.courier || "").trim();
  const status = payload.status;
  const note = String(payload.note || "").trim();
  const pageId = String(payload.pageId || "").trim() || null;

  if (!orderId || !customerName || !phone || !address) {
    return {
      success: false,
      message: "Customer name, phone and address are required.",
    };
  }

  const allowedStatuses = [
    "PENDING_CONFIRMATION",
    "READY_TO_SHIP",
    "NO_ANSWER",
    "PHONE_OFF",
    "STOCK_OUT",
    "CANCELLED",
    "RETURNED",
    "DOUBLE_ORDER",
  ];

  if (!allowedStatuses.includes(status)) {
    return {
      success: false,
      message: "Invalid order status.",
    };
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return {
      success: false,
      message: "Order not found.",
    };
  }

  const courierRecord =
    courier && status === "READY_TO_SHIP"
      ? await prisma.courier.findFirst({
          where: {
            slug: courier,
            status: true,
          },
          select: {
            id: true,
            slug: true,
          },
        })
      : null;

  if (status === "READY_TO_SHIP" && courier && !courierRecord) {
    return {
      success: false,
      message: "Selected courier is invalid or inactive.",
    };
  }

  if (pageId) {
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        status: true,
      },
      select: {
        id: true,
      },
    });

    if (!page) {
      return {
        success: false,
        message: "Selected page is invalid or inactive.",
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const cleanedItems = (payload.items || [])
        .map((item) => ({
          orderItemId: String(item.orderItemId || "").trim(),
          productId: String(item.productId || "").trim(),
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.productId && item.quantity > 0);

      if (!cleanedItems.length) {
        throw new Error("Please add at least one valid product.");
      }

      const productIds = [...new Set(cleanedItems.map((item) => item.productId))];

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          status: true,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          sellingPrice: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more selected products are invalid.");
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      const existingIds = new Set(order.items.map((item) => item.id));
      const keepIds = new Set(
        cleanedItems
          .map((item) => item.orderItemId)
          .filter((id) => id && existingIds.has(id))
      );

      const deleteIds = order.items
        .filter((item) => !keepIds.has(item.id))
        .map((item) => item.id);

      if (deleteIds.length) {
        await tx.orderItem.deleteMany({
          where: {
            id: { in: deleteIds },
          },
        });
      }

      for (const item of cleanedItems) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("Selected product is invalid.");
        }

        const unitPrice = Number(product.sellingPrice);
        const lineTotal = unitPrice * item.quantity;

        if (item.orderItemId && existingIds.has(item.orderItemId)) {
          await tx.orderItem.update({
            where: {
              id: item.orderItemId,
            },
            data: {
              productId: product.id,
              productSku: product.sku,
              productName: product.name,
              quantity: item.quantity,
              unitPrice,
              lineTotal,
            },
          });
        } else {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              productSku: product.sku,
              productName: product.name,
              quantity: item.quantity,
              unitPrice,
              lineTotal,
            },
          });
        }
      }

      const freshItems = await tx.orderItem.findMany({
        where: {
          orderId: order.id,
        },
      });

      if (!freshItems.length) {
        throw new Error("Order must contain at least one product.");
      }

      const subtotal = freshItems.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );

      const totalAmount = Math.max(
        subtotal + deliveryCharge - discount - advance,
        0
      );

      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          customerName,
          phone,
          address,
          discount,
          advance,
          deliveryCharge,
          subtotal,
          totalAmount,
          courier: courierRecord?.slug || (courier ? courier : null),
          readyToShipAt: readyToShipAt
            ? new Date(`${readyToShipAt}T00:00:00`)
            : order.readyToShipAt,
          pageId,
          orderStatus: status ,
          note,
        },
      });
    });

    revalidatePath("/dashboard/all-orders");
    revalidatePath(`/dashboard/all-orders/${orderId}`);
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/pending-orders");
    revalidatePath("/dashboard/call");
    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/product-report");

    return {
      success: true,
      message: "Order updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update order.",
    };
  }
}

export async function deleteOrderAction(
  _prevState: DeleteOrderState,
  formData: FormData
): Promise<DeleteOrderState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const orderId = String(formData.get("orderId") || "").trim();

  if (!orderId) {
    return {
      success: false,
      message: "Order ID is required.",
    };
  }

  try {
    await prisma.order.delete({
      where: {
        id: orderId,
      },
    });

    revalidatePath("/dashboard/all-orders");
    revalidatePath(`/dashboard/all-orders/${orderId}`);
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/pending-orders");
    revalidatePath("/dashboard/call");
    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/product-report");
    revalidatePath("/dashboard/post-print-actions");

    return {
      success: true,
      message: "Order deleted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete order.",
    };
  }
}