"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreatePurchaseOrderInput = {
  productId: string;
  orderDate: string;
  quantity: number;
  quantityType: string;
  productImage?: string;
  unitPriceUsd: number;
  platformChargeUsd: number;
  shippingUsd: number;
  note?: string;
};

type CreatePurchasePaymentInput = {
  purchaseOrderId: string;
  paymentDate: string;
  paymentType: string;
  amountUsd: number;
  usdRate: number;
  note?: string;
};

type ActionResult = {
  success: boolean;
  message: string;
};

function toMoney(value: unknown) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

function purchaseOrderListPath() {
  return "/dashboard/products-purchases/purchase-orders";
}

function purchaseOrderDetailsPath(id: string) {
  return `/dashboard/products-purchases/purchase-orders/${id}`;
}

async function generateInvoiceNo() {
  const total = await prisma.purchaseOrder.count();
  const serial = String(total + 1).padStart(4, "0");

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `PO-${year}${month}${day}-${serial}`;
}

async function refreshPurchaseOrderStatus(purchaseOrderId: string) {
  const order = await prisma.purchaseOrder.findUnique({
    where: {
      id: purchaseOrderId,
    },
    include: {
      payments: true,
    },
  });

  if (!order) return;

  const totalPayableUsd = Number(order.subtotalUsd);

  const paidUsd = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountUsd),
    0
  );

  await prisma.purchaseOrder.update({
    where: {
      id: purchaseOrderId,
    },
    data: {
      status:
        paidUsd >= totalPayableUsd
          ? "PAID"
          : paidUsd > 0
            ? "PARTIAL_PAID"
            : "PENDING",
    },
  });
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const productId = String(payload.productId || "").trim();
  const quantity = Number(payload.quantity || 0);
  const quantityType = String(payload.quantityType || "").trim();
  const orderDate = String(payload.orderDate || "").trim();

  const unitPriceUsd = toMoney(payload.unitPriceUsd);
  const platformChargeUsd = toMoney(payload.platformChargeUsd);
  const shippingUsd = toMoney(payload.shippingUsd);

  const note = String(payload.note || "").trim();
  const productImage = String(payload.productImage || "").trim();

  if (!productId) {
    return {
      success: false,
      message: "Product is required.",
    };
  }

  if (quantity <= 0) {
    return {
      success: false,
      message: "Quantity must be greater than 0.",
    };
  }

  if (!quantityType) {
    return {
      success: false,
      message: "Quantity type is required.",
    };
  }

  if (unitPriceUsd < 0 || platformChargeUsd < 0 || shippingUsd < 0) {
    return {
      success: false,
      message: "Price and charges cannot be negative.",
    };
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: true,
    },
    include: {
      parent: true,
    },
  });

  if (!product) {
    return {
      success: false,
      message: "Invalid product selected.",
    };
  }

  const subtotalUsd =
    quantity * unitPriceUsd + platformChargeUsd + shippingUsd;

  try {
    const invoiceNo = await generateInvoiceNo();

    await prisma.purchaseOrder.create({
      data: {
        invoiceNo,
        productId: product.id,

        productSku: product.sku,
        productName: product.name,
        parentSku: product.parent.sku,

        orderDate: orderDate
          ? new Date(`${orderDate}T00:00:00`)
          : new Date(),

        quantity,
        quantityType,

        productImage: productImage || null,

        unitPriceUsd,
        platformChargeUsd,
        shippingUsd,
        subtotalUsd,

        note,
        status: "PENDING",
      },
    });

    revalidatePath(purchaseOrderListPath());

    return {
      success: true,
      message: "Purchase order created successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create purchase order.",
    };
  }
}

export async function createPurchasePayment(
  payload: CreatePurchasePaymentInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const purchaseOrderId = String(payload.purchaseOrderId || "").trim();
  const paymentDate = String(payload.paymentDate || "").trim();
  const paymentType = String(payload.paymentType || "").trim();
  const amountUsd = toMoney(payload.amountUsd);
  const usdRate = toMoney(payload.usdRate);
  const note = String(payload.note || "").trim();

  if (!purchaseOrderId) {
    return {
      success: false,
      message: "Purchase order ID is required.",
    };
  }

  if (!paymentDate) {
    return {
      success: false,
      message: "Payment date is required.",
    };
  }

  if (!paymentType) {
    return {
      success: false,
      message: "Payment type is required.",
    };
  }

  if (amountUsd <= 0) {
    return {
      success: false,
      message: "Payment USD amount must be greater than 0.",
    };
  }

  if (usdRate <= 0) {
    return {
      success: false,
      message: "USD rate must be greater than 0.",
    };
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: {
      id: purchaseOrderId,
    },
    include: {
      payments: true,
    },
  });

  if (!purchaseOrder) {
    return {
      success: false,
      message: "Purchase order not found.",
    };
  }

  const alreadyPaidUsd = purchaseOrder.payments.reduce(
    (sum, payment) => sum + Number(payment.amountUsd),
    0
  );

  const totalPayableUsd = Number(purchaseOrder.subtotalUsd);
  const dueUsd = totalPayableUsd - alreadyPaidUsd;

  if (amountUsd > dueUsd) {
    return {
      success: false,
      message: `Payment amount cannot be greater than due amount $${dueUsd.toFixed(
        2
      )}.`,
    };
  }

  const amountBdt = amountUsd * usdRate;

  try {
    await prisma.purchasePayment.create({
      data: {
        purchaseOrderId,
        paymentDate: new Date(`${paymentDate}T00:00:00`),
        paymentType,
        amountUsd,
        usdRate,
        amountBdt,
        note,
      },
    });

    await refreshPurchaseOrderStatus(purchaseOrderId);

    revalidatePath(purchaseOrderListPath());
    revalidatePath(purchaseOrderDetailsPath(purchaseOrderId));

    return {
      success: true,
      message: "Payment added successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to add payment.",
    };
  }
}

export async function deletePurchaseOrder(
  purchaseOrderId: string
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = String(purchaseOrderId || "").trim();

  if (!id) {
    return {
      success: false,
      message: "Purchase order ID is required.",
    };
  }

  try {
    await prisma.purchaseOrder.delete({
      where: {
        id,
      },
    });

    revalidatePath(purchaseOrderListPath());

    return {
      success: true,
      message: "Purchase order deleted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete purchase order.",
    };
  }
}

export async function deletePurchasePayment(
  paymentId: string,
  purchaseOrderId: string
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = String(paymentId || "").trim();
  const orderId = String(purchaseOrderId || "").trim();

  if (!id) {
    return {
      success: false,
      message: "Payment ID is required.",
    };
  }

  if (!orderId) {
    return {
      success: false,
      message: "Purchase order ID is required.",
    };
  }

  try {
    await prisma.purchasePayment.delete({
      where: {
        id,
      },
    });

    await refreshPurchaseOrderStatus(orderId);

    revalidatePath(purchaseOrderListPath());
    revalidatePath(purchaseOrderDetailsPath(orderId));

    return {
      success: true,
      message: "Payment deleted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete payment.",
    };
  }
}