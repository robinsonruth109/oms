"use server";

export type IncomingIntegrationItem = {
  sku?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
};

export type IncomingIntegrationOrder = {
  apiKey?: string | null;

  externalOrderId?: string | null;
  invoiceId?: string | null;

  customerName?: string | null;
  phone?: string | null;
  address?: string | null;

  // Optional Shopify fallbacks. Keep the existing fields above; these make
  // imports resilient when a COD app populates only shipping address fields.
  shippingPhone?: string | null;
  shippingCustomerName?: string | null;
  shippingFirstName?: string | null;
  shippingLastName?: string | null;
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  email?: string | null;

  deliveryCharge?: number | string | null;
  discount?: number | string | null;
  advance?: number | string | null;

  // Optional authoritative source total. If supplied, OMS keeps the Shopify
  // total even when line-item data is incomplete.
  totalAmount?: number | string | null;

  note?: string | null;
  items?: IncomingIntegrationItem[] | null;
};

type ImportResult =
  | {
      success: true;
      created: boolean;
      orderId: string;
      message: string;
      warnings?: string[];
    }
  | {
      success: false;
      status: number;
      message: string;
    };

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = cleanString(value);
    if (text) return text;
  }
  return "";
}

function cleanMoney(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function buildShippingAddress(payload: IncomingIntegrationOrder) {
  return [
    payload.shippingAddress1,
    payload.shippingAddress2,
    payload.shippingCity,
    payload.shippingProvince,
    payload.shippingZip,
    payload.shippingCountry,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(", ");
}

function buildShippingName(payload: IncomingIntegrationOrder) {
  return [payload.shippingFirstName, payload.shippingLastName]
    .map(cleanString)
    .filter(Boolean)
    .join(" ")
    .trim();
}

function mergeImportWarnings(note: string, warnings: string[]) {
  if (!warnings.length) return note || null;

  const warningText = `[OMS IMPORT WARNING: ${warnings.join("; ")}]`;

  return [note, warningText].filter(Boolean).join("\n");
}

export async function importIntegrationOrderBySlug(
  slug: string,
  payload: IncomingIntegrationOrder
): Promise<ImportResult> {
  // Lazy-load Prisma so Next/Railway build-time route collection never
  // initializes the MariaDB adapter.
  const { prisma } = await import("@/lib/prisma");

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

  // We only require a stable order identity. Customer fields are allowed to
  // be incomplete so the order is NEVER discarded just because Shopify/COD
  // apps populated a different customer field.
  const externalOrderId = firstNonEmpty(
    payload.externalOrderId,
    payload.invoiceId
  );

  if (!externalOrderId) {
    return {
      success: false,
      status: 400,
      message: "externalOrderId or invoiceId is required.",
    };
  }

  const invoiceId = firstNonEmpty(payload.invoiceId, externalOrderId);
  const shippingName = firstNonEmpty(
    payload.shippingCustomerName,
    buildShippingName(payload)
  );

  const customerName = firstNonEmpty(
    payload.customerName,
    shippingName,
    payload.email,
    "Customer"
  );

  const rawPhone = firstNonEmpty(payload.phone, payload.shippingPhone);
  const phone = normalizePhone(rawPhone) || "PHONE_MISSING";

  const shippingAddress = buildShippingAddress(payload);
  const address =
    firstNonEmpty(payload.address, shippingAddress) || "ADDRESS_MISSING";

  const note = cleanString(payload.note);
  const deliveryCharge = cleanMoney(payload.deliveryCharge);
  const discount = cleanMoney(payload.discount);
  const advance = cleanMoney(payload.advance);
  const suppliedTotalAmount = cleanMoney(payload.totalAmount);

  const warnings: string[] = [];

  if (!rawPhone) warnings.push("customer phone missing");
  if (address === "ADDRESS_MISSING") warnings.push("customer address missing");
  if (
    customerName === "Customer" ||
    customerName === cleanString(payload.email)
  ) {
    warnings.push("customer name incomplete");
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
      warnings,
    };
  }

  // If the same Shopify invoice was already imported through a retry or a
  // changed external id, treat it as success instead of returning 409.
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
      success: true,
      created: false,
      orderId: invoiceExists.id,
      message: "Invoice already exists in OMS. Duplicate import ignored.",
      warnings,
    };
  }

  const incomingItems = Array.isArray(payload.items) ? payload.items : [];

  let normalizedItems = incomingItems
    .map((item) => {
      const sku = cleanString(item?.sku);
      const name = firstNonEmpty(item?.name, sku);
      const rawQuantity = Number(item?.quantity ?? 1);
      const quantity =
        Number.isFinite(rawQuantity) && rawQuantity > 0
          ? Math.max(1, Math.trunc(rawQuantity))
          : 1;
      const price = cleanMoney(item?.price);

      return {
        sku,
        name,
        quantity,
        price,
      };
    })
    .filter((item) => item.name);

  // Never discard an order because a third-party Shopify app produced an
  // unexpected/missing line-item payload. Keep a placeholder item so the
  // order reaches the calling team and can be corrected manually.
  if (!normalizedItems.length) {
    const fallbackItemValue = Math.max(
      suppliedTotalAmount - deliveryCharge + discount + advance,
      0
    );

    normalizedItems = [
      {
        sku: "",
        name: "Shopify order item unavailable - review order",
        quantity: 1,
        price: fallbackItemValue,
      },
    ];

    warnings.push("line-item data missing or invalid");
  }

  const skuList = [
    ...new Set(normalizedItems.map((item) => item.sku).filter(Boolean)),
  ];

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
    const matchedProduct = item.sku ? productMap.get(item.sku) : null;

    // Prefer the source price. If source price is zero/missing but the SKU
    // matches OMS, use OMS selling price as a fallback.
    const unitPrice =
      item.price > 0
        ? item.price
        : matchedProduct
          ? Number(matchedProduct.sellingPrice)
          : 0;

    const lineTotal = item.quantity * unitPrice;
    subtotal += lineTotal;

    return {
      productId: matchedProduct?.id ?? null,
      productSku: item.sku || matchedProduct?.sku || "",
      productName:
        item.name || matchedProduct?.name || "Shopify order item unavailable",
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    };
  });

  const calculatedTotalAmount = Math.max(
    subtotal + deliveryCharge - discount - advance,
    0
  );

  const totalAmount =
    suppliedTotalAmount > 0 ? suppliedTotalAmount : calculatedTotalAmount;

  try {
    const order = await prisma.$transaction(
      async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            integrationId: integration.id,
            externalOrderId,
            invoiceId,
            sourceId: integration.sourceId,
            customerName,
            phone,
            address,
            subtotal,
            discount,
            advance,
            deliveryCharge,
            totalAmount,
            orderStatus: "PENDING_CONFIRMATION",
            courier: null,
            note: mergeImportWarnings(note, warnings),
          },
        });

        await tx.orderItem.createMany({
          data: preparedItems.map((item) => ({
            orderId: createdOrder.id,
            productId: item.productId,
            productSku: item.productSku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        });

        return createdOrder;
      },
      {
        timeout: 20000,
        maxWait: 20000,
      }
    );

    return {
      success: true,
      created: true,
      orderId: order.id,
      message:
        warnings.length > 0
          ? "Order imported with warning(s); review customer/order details."
          : "Order imported successfully.",
      warnings,
    };
  } catch (error) {
    // Handle a duplicate race safely. Shopify/Flow retries should never create
    // duplicate OMS orders, but they also should not be treated as lost.
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";

    if (errorCode === "P2002") {
      const duplicate = await prisma.order.findFirst({
        where: {
          OR: [
            {
              integrationId: integration.id,
              externalOrderId,
            },
            {
              invoiceId,
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return {
          success: true,
          created: false,
          orderId: duplicate.id,
          message: "Duplicate retry received; existing OMS order kept.",
          warnings,
        };
      }
    }

    console.error("Integration order import failed:", {
      integration: integration.slug,
      externalOrderId,
      invoiceId,
      error,
    });

    return {
      success: false,
      status: 500,
      message:
        "OMS could not save this order due to a temporary server/database error. Retry the request.",
    };
  }
}
