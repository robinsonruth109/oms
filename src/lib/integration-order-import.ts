import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type IncomingIntegrationItem = {
  sku?: string;
  name: string;
  quantity: number;
  price: number;
};

export type IncomingIntegrationOrder = {
  apiKey: string;
  externalOrderId: string;
  invoiceId: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryCharge?: number;
  discount?: number;
  advance?: number;
  note?: string;
  items: IncomingIntegrationItem[];
};

type ImportResult =
  | {
      success: true;
      created: boolean;
      orderId: string;
      message: string;
    }
  | {
      success: false;
      status: number;
      message: string;
    };

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanMoney(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isNaN(num) ? 0 : num;
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

export async function importIntegrationOrderBySlug(
  slug: string,
  payload: IncomingIntegrationOrder
): Promise<ImportResult> {
  const integration = await prisma.integration.findUnique({
    where: { slug },
    include: {
      source: true,
    },
  });

  if (!integration) {
    return {
      success: false,
      status: 404,
      message: "Integration not found.",
    };
  }

  if (!integration.status) {
    return {
      success: false,
      status: 403,
      message: "Integration is inactive.",
    };
  }

  if (cleanString(payload.apiKey) !== integration.apiKey) {
    return {
      success: false,
      status: 401,
      message: "Invalid API key.",
    };
  }

  const externalOrderId = cleanString(payload.externalOrderId);
  const invoiceId = cleanString(payload.invoiceId);
  const customerName = cleanString(payload.customerName);
  const phone = normalizePhone(cleanString(payload.phone));
  const address = cleanString(payload.address);
  const note = cleanString(payload.note);
  const deliveryCharge = cleanMoney(payload.deliveryCharge);
  const discount = cleanMoney(payload.discount);
  const advance = cleanMoney(payload.advance);

  if (!externalOrderId || !invoiceId || !customerName || !phone || !address) {
    return {
      success: false,
      status: 400,
      message:
        "externalOrderId, invoiceId, customerName, phone and address are required.",
    };
  }

  if (!Array.isArray(payload.items) || !payload.items.length) {
    return {
      success: false,
      status: 400,
      message: "At least one item is required.",
    };
  }

  const normalizedItems = payload.items
    .map((item) => ({
      sku: cleanString(item.sku),
      name: cleanString(item.name),
      quantity: Number(item.quantity || 0),
      price: cleanMoney(item.price),
    }))
    .filter((item) => item.name && item.quantity > 0 && item.price >= 0);

  if (!normalizedItems.length) {
    return {
      success: false,
      status: 400,
      message: "No valid items found in payload.",
    };
  }

  const existingOrder = await prisma.order.findUnique({
    where: {
      integrationId_externalOrderId: {
        integrationId: integration.id,
        externalOrderId,
      },
    },
  });

  if (existingOrder) {
    return {
      success: true,
      created: false,
      orderId: existingOrder.id,
      message: "Duplicate order ignored. Order already exists.",
    };
  }

  const invoiceExists = await prisma.order.findFirst({
    where: {
      invoiceId,
    },
    select: {
      id: true,
    },
  });

  if (invoiceExists) {
    return {
      success: false,
      status: 409,
      message: "This invoiceId already exists in OMS.",
    };
  }

  const skuList = normalizedItems.map((item) => item.sku).filter(Boolean);

  const matchedProducts = skuList.length
    ? await prisma.product.findMany({
        where: {
          sku: {
            in: skuList,
          },
        },
      })
    : [];

  const productMap = new Map(
    matchedProducts.map((product) => [product.sku, product])
  );

  let subtotal = 0;

  const preparedItems = normalizedItems.map((item) => {
    const lineTotal = item.quantity * item.price;
    subtotal += lineTotal;

    const matchedProduct = item.sku ? productMap.get(item.sku) : null;

    return {
      productId: matchedProduct?.id ?? null,
      productSku: item.sku || matchedProduct?.sku || "",
      productName: item.name || matchedProduct?.name || "Unnamed Product",
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal,
    };
  });

  const totalAmount = Math.max(subtotal + deliveryCharge - discount - advance, 0);

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        integrationId: integration.id,
        externalOrderId,
        invoiceId,
        sourceId: integration.sourceId,
        customerName,
        phone,
        address,
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(discount),
        advance: new Prisma.Decimal(advance),
        deliveryCharge: new Prisma.Decimal(deliveryCharge),
        totalAmount: new Prisma.Decimal(totalAmount),
        orderStatus: "PENDING_CONFIRMATION",
        courier: null,
        note: note || null,
      },
    });

    await tx.orderItem.createMany({
      data: preparedItems.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        lineTotal: new Prisma.Decimal(item.lineTotal),
      })),
    });

    return createdOrder;
  });

  return {
    success: true,
    created: true,
    orderId: order.id,
    message: "Order imported successfully.",
  };
}