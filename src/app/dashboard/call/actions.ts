"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SaveCallingOrderInput = {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  discount: number;
  deliveryCharge: number;
  readyToShipAt: string;
  courier: string;
  status: "READY_TO_SHIP" | "NO_ANSWER" | "PHONE_OFF" | "STOCK_OUT" | "CANCELLED";
  note?: string;
  pageId?: string;
  singleItem?: {
    orderItemId: string;
    productId: string;
    quantity: number;
  } | null;
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

function toMoney(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isNaN(num) ? 0 : num;
}

function normalizePhone(value: string) {
  return String(value || "").trim().replace(/\s+/g, "");
}

export async function saveCallingOrder(
  payload: SaveCallingOrderInput
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

  if (
    !["READY_TO_SHIP", "NO_ANSWER", "PHONE_OFF", "STOCK_OUT", "CANCELLED"].includes(
      status
    )
  ) {
    return {
      success: false,
      message: "Invalid calling status.",
    };
  }

  if (status === "READY_TO_SHIP") {
    if (!courier) {
      return {
        success: false,
        message: "Please select a courier before confirm.",
      };
    }

    if (!readyToShipAt) {
      return {
        success: false,
        message: "Please select ready to ship date.",
      };
    }
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

  if (!["PENDING_CONFIRMATION", "NO_ANSWER", "PHONE_OFF"].includes(order.orderStatus)) {
    return {
      success: false,
      message: "This order is no longer editable from calling panel.",
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

  if (status === "READY_TO_SHIP" && !courierRecord) {
    return {
      success: false,
      message: "Selected courier is invalid or inactive.",
    };
  }

  let subtotal = Number(order.subtotal);
  let totalAmount = Number(order.totalAmount);

  try {
    await prisma.$transaction(async (tx) => {
      if (payload.items && payload.items.length > 0) {
        const cleanedItems = payload.items
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
      } else if (payload.singleItem) {
        const orderItemId = String(payload.singleItem.orderItemId || "").trim();
        const productId = String(payload.singleItem.productId || "").trim();
        const quantity = Number(payload.singleItem.quantity || 0);

        if (!orderItemId || !productId || quantity <= 0) {
          throw new Error("Invalid product row data.");
        }

        const targetItem = order.items.find((item) => item.id === orderItemId);

        if (!targetItem) {
          throw new Error("Order item not found.");
        }

        const product = await tx.product.findFirst({
          where: {
            id: productId,
            status: true,
          },
          select: {
            id: true,
            sku: true,
            name: true,
            sellingPrice: true,
          },
        });

        if (!product) {
          throw new Error("Selected product is invalid.");
        }

        const updatedLineTotal = Number(product.sellingPrice) * quantity;

        await tx.orderItem.update({
          where: {
            id: orderItemId,
          },
          data: {
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            quantity,
            unitPrice: Number(product.sellingPrice),
            lineTotal: updatedLineTotal,
          },
        });
      }

      const freshItems = await tx.orderItem.findMany({
        where: {
          orderId: order.id,
        },
      });

      if (!freshItems.length) {
        throw new Error("Order must contain at least one product.");
      }

      subtotal = freshItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      totalAmount = Math.max(
        subtotal + deliveryCharge - discount - Number(order.advance),
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
          deliveryCharge,
          subtotal,
          totalAmount,
          courier: courierRecord?.slug || null,
          readyToShipAt: readyToShipAt
            ? new Date(`${readyToShipAt}T00:00:00`)
            : order.readyToShipAt,
          orderStatus: status,
          note: note || order.note,
          calledByUserId: session.user.id,
          calledAt: new Date(),
          pageId,
        },
      });
    });

    revalidatePath("/dashboard/call");
    revalidatePath(`/dashboard/call/${order.id}`);
    revalidatePath("/dashboard/pending-orders");
    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/cancelled");

    return {
      success: true,
      message: "Calling order updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update calling order.",
    };
  }
}

export async function directCancelCallingOrder(
  orderId: string
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = String(orderId || "").trim();

  if (!id) {
    return {
      success: false,
      message: "Order id is required.",
    };
  }

  await prisma.order.update({
    where: {
      id,
    },
    data: {
      orderStatus: "CANCELLED",
      calledByUserId: session.user.id,
      calledAt: new Date(),
    },
  });

  revalidatePath("/dashboard/call");
  revalidatePath(`/dashboard/call/${id}`);
  revalidatePath("/dashboard/pending-orders");
  revalidatePath("/dashboard/cancelled");

  return {
    success: true,
    message: "Order cancelled successfully.",
  };
}