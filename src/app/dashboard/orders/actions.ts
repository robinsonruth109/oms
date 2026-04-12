"use server";

import { Prisma, OrderStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateOrderState = {
  success: boolean;
  message: string;
};

type IncomingOrderItem = {
  productId: string;
  quantity: number;
};

function toMoney(value: unknown) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  const numberValue = Number(raw || 0);

  if (Number.isNaN(numberValue)) {
    return 0;
  }

  return numberValue;
}

function parseItems(raw: string): IncomingOrderItem[] {
  try {
    const parsed = JSON.parse(raw) as IncomingOrderItem[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        productId: String(item.productId || "").trim(),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.productId && item.quantity > 0);
  } catch {
    return [];
  }
}

export async function createManualOrder(
  _prevState: CreateOrderState,
  formData: FormData
): Promise<CreateOrderState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const pageId = String(formData.get("pageId") || "").trim();
  const sourceId = String(formData.get("sourceId") || "").trim();
  const courier = String(formData.get("courier") || "").trim();

  const customerName = String(formData.get("customerName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  const discount = toMoney(formData.get("discount"));
  const advance = toMoney(formData.get("advance"));
  const deliveryCharge = toMoney(formData.get("deliveryCharge"));
  const note = String(formData.get("note") || "").trim();

  const items = parseItems(String(formData.get("items") || "[]"));

  if (!pageId || !sourceId || !courier || !customerName || !address || !phone) {
    return {
      success: false,
      message: "Please fill all order header fields.",
    };
  }

  if (!items.length) {
    return {
      success: false,
      message: "Please add at least one product.",
    };
  }

  const [page, source, courierRecord, products] = await Promise.all([
    prisma.page.findUnique({
      where: { id: pageId },
    }),
    prisma.orderSource.findUnique({
      where: { id: sourceId },
    }),
    prisma.courier.findFirst({
      where: {
        slug: courier,
        status: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.product.findMany({
      where: {
        id: {
          in: items.map((item) => item.productId),
        },
        status: true,
      },
    }),
  ]);

  if (!page || !page.status) {
    return {
      success: false,
      message: "Selected page is invalid or inactive.",
    };
  }

  if (!source || !source.status) {
    return {
      success: false,
      message: "Selected source is invalid or inactive.",
    };
  }

  if (!courierRecord) {
    return {
      success: false,
      message: "Selected courier is invalid or inactive.",
    };
  }

  if (products.length !== items.length) {
    return {
      success: false,
      message: "One or more selected products are invalid or inactive.",
    };
  }

  const productMap = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0;

  const preparedItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const unitPrice = Number(product.sellingPrice);
    const lineTotal = unitPrice * item.quantity;

    subtotal += lineTotal;

    return {
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    };
  });

  const totalAmount = Math.max(subtotal + deliveryCharge - discount - advance, 0);

  try {
    await prisma.$transaction(async (tx) => {
      const currentPage = await tx.page.findUnique({
        where: { id: pageId },
      });

      if (!currentPage) {
        throw new Error("Page not found.");
      }

      const nextSerial = currentPage.lastInvoiceSerial + 1;
      const invoiceId = `${currentPage.prefixCode}${nextSerial}`;

      const order = await tx.order.create({
        data: {
          invoiceId,
          sourceId,
          pageId,
          customerName,
          address,
          phone,
          subtotal: new Prisma.Decimal(subtotal),
          discount: new Prisma.Decimal(discount),
          advance: new Prisma.Decimal(advance),
          deliveryCharge: new Prisma.Decimal(deliveryCharge),
          totalAmount: new Prisma.Decimal(totalAmount),
          orderStatus: OrderStatus.READY_TO_SHIP,
          courier: courierRecord.slug,
          note: note || null,
          readyToShipAt: new Date(),
        },
      });

      await tx.orderItem.createMany({
        data: preparedItems.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          lineTotal: new Prisma.Decimal(item.lineTotal),
        })),
      });

      await tx.page.update({
        where: { id: pageId },
        data: {
          lastInvoiceSerial: nextSerial,
        },
      });
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/pages");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: "Manual order created and sent to selected courier successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to create order. Please try again.",
    };
  }
}