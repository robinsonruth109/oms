import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOP_SETTING_ID = "default";

const DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE = 70;
const DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE = 150;

const MAX_CUSTOMER_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 1000;
const MAX_NOTE_LENGTH = 1000;

type DeliveryArea = "INSIDE_DHAKA" | "OUTSIDE_DHAKA";

type CreateReelOrderBody = {
  reelId?: unknown;
  categorySlug?: unknown;
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
  quantity?: unknown;
  deliveryArea?: unknown;
  customerNote?: unknown;
  website?: unknown;
  eventId?: unknown;
  checkoutRequestId?: unknown;
  eventSourceUrl?: unknown;
  fbp?: unknown;
  fbc?: unknown;
};

type ValidationSuccess = {
  success: true;
  data: {
    reelId: string;
    categorySlug: string;
    customerName: string;
    phone: string;
    address: string;
    quantity: number;
    deliveryArea: DeliveryArea;
    customerNote: string | null;
    eventId: string;
    checkoutRequestId: string;
    eventSourceUrl: string;
    fbp: string | null;
    fbc: string | null;
  };
};

type ValidationFailure = {
  success: false;
  message: string;
  field?: string;
};

type ValidationResult = ValidationSuccess | ValidationFailure;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizePhone(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[^\d]/g, "");
}

function normalizeQuantity(value: unknown): number {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return Number.NaN;
  }

  const quantity = Number(value);

  if (!Number.isInteger(quantity)) {
    return Number.NaN;
  }

  return quantity;
}

function isBangladeshMobileNumber(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(phone);
}

function validateBody(
  body: CreateReelOrderBody
): ValidationResult {
  const reelId = normalizeText(body.reelId);

  if (!reelId) {
    return {
      success: false,
      field: "reelId",
      message: "রিল প্রোডাক্ট পাওয়া যায়নি।",
    };
  }

  const categorySlug = normalizeText(
    body.categorySlug
  ).toLowerCase();

  if (!categorySlug) {
    return {
      success: false,
      field: "categorySlug",
      message: "রিল ক্যাটাগরি পাওয়া যায়নি।",
    };
  }

  const customerName = normalizeText(
    body.customerName
  );

  if (!customerName) {
    return {
      success: false,
      field: "customerName",
      message: "আপনার নাম লিখুন।",
    };
  }

  if (customerName.length > MAX_CUSTOMER_NAME_LENGTH) {
    return {
      success: false,
      field: "customerName",
      message: "নামটি অনেক বড় হয়েছে।",
    };
  }

  const phone = normalizePhone(body.phone);

  if (!isBangladeshMobileNumber(phone)) {
    return {
      success: false,
      field: "phone",
      message:
        "সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর লিখুন।",
    };
  }

  const address = normalizeText(body.address);

  if (!address) {
    return {
      success: false,
      field: "address",
      message: "সম্পূর্ণ ঠিকানা লিখুন।",
    };
  }

  if (address.length > MAX_ADDRESS_LENGTH) {
    return {
      success: false,
      field: "address",
      message: "ঠিকানাটি অনেক বড় হয়েছে।",
    };
  }

  const quantity = normalizeQuantity(body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      success: false,
      field: "quantity",
      message:
        "পণ্যের পরিমাণ কমপক্ষে ১ হতে হবে।",
    };
  }

  const deliveryArea = normalizeText(
    body.deliveryArea
  );

  if (
    deliveryArea !== "INSIDE_DHAKA" &&
    deliveryArea !== "OUTSIDE_DHAKA"
  ) {
    return {
      success: false,
      field: "deliveryArea",
      message: "কুরিয়ার এলাকা নির্বাচন করুন।",
    };
  }

  const customerNote =
    normalizeText(body.customerNote) || null;

  if (
    customerNote &&
    customerNote.length > MAX_NOTE_LENGTH
  ) {
    return {
      success: false,
      field: "customerNote",
      message: "বিশেষ নির্দেশনাটি অনেক বড় হয়েছে।",
    };
  }

  const checkoutRequestId =
    normalizeText(body.checkoutRequestId) ||
    normalizeText(body.eventId) ||
    `checkout_${randomUUID()}`;

  if (checkoutRequestId.length > 191) {
    return {
      success: false,
      field: "checkoutRequestId",
      message: "অর্ডার অনুরোধটি সঠিক নয়।",
    };
  }

  // Browser Pixel and CAPI must share one immutable Purchase event ID.
  // checkoutRequestId is generated once by the client and persisted on Order.
  const eventId = checkoutRequestId;
  const eventSourceUrl = normalizeText(body.eventSourceUrl) || "";
  const fbp = normalizeText(body.fbp) || null;
  const fbc = normalizeText(body.fbc) || null;

  return {
    success: true,
    data: {
      reelId,
      categorySlug,
      customerName,
      phone,
      address,
      quantity,
      deliveryArea,
      customerNote,
      checkoutRequestId,
      eventId,
      eventSourceUrl,
      fbp,
      fbc,
    },
  };
}

function createOrderId(): string {
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase();

  const randomPart = randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `REEL-${timestamp}-${randomPart}`;
}

function createInvoiceId(
  prefixCode: string,
  serial: number
): string {
  return `${prefixCode}${String(serial).padStart(
    5,
    "0"
  )}`;
}

function createOrderNote({
  categoryName,
  categorySlug,
  reelTitle,
  deliveryArea,
  customerNote,
}: {
  categoryName: string;
  categorySlug: string;
  reelTitle: string;
  deliveryArea: DeliveryArea;
  customerNote: string | null;
}): string {
  const deliveryLabel =
    deliveryArea === "INSIDE_DHAKA"
      ? "ঢাকা শহরের মধ্যে"
      : "ঢাকা শহরের বাইরে";

  const lines = [
    "Order source: Public Reel Checkout",
    `Reel category: ${categoryName}`,
    `Reel title: ${reelTitle}`,
    `Landing page: /reels/${categorySlug}`,
    `Delivery area: ${deliveryLabel}`,
  ];

  if (customerNote) {
    lines.push(
      `Customer instruction: ${customerNote}`
    );
  }

  return lines.join("\n");
}

export async function POST(request: Request) {
  const { prisma } = await import("@/lib/prisma");
  let replayCheckoutRequestId = "";

  try {
    let body: CreateReelOrderBody;

    try {
      body =
        (await request.json()) as CreateReelOrderBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "সঠিক অর্ডার তথ্য পাওয়া যায়নি।",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Honeypot field for basic bot protection.
     */
    if (normalizeText(body.website)) {
      return NextResponse.json(
        {
          success: true,
          message:
            "আপনার অর্ডারটি গ্রহণ করা হয়েছে।",
        },
        {
          status: 200,
        }
      );
    }

    const validation = validateBody(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.message,
          field: validation.field,
        },
        {
          status: 400,
        }
      );
    }

    const {
      reelId,
      categorySlug,
      customerName,
      phone,
      address,
      quantity,
      deliveryArea,
      customerNote,
      checkoutRequestId,
      eventId,
      eventSourceUrl,
      fbp,
      fbc,
    } = validation.data;

    replayCheckoutRequestId = checkoutRequestId;

    const existingOrder = await prisma.order.findUnique({
      where: { checkoutRequestId },
      select: {
        id: true,
        orderId: true,
        invoiceId: true,
        customerName: true,
        phone: true,
        subtotal: true,
        deliveryCharge: true,
        totalAmount: true,
        orderStatus: true,
        createdAt: true,
        checkoutRequestId: true,
        metaPurchaseEventId: true,
        items: {
          select: {
            id: true,
            productId: true,
            productSku: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });

    if (existingOrder) {
      return NextResponse.json({
        success: true,
        idempotentReplay: true,
        message: "এই অর্ডারটি ইতোমধ্যে গ্রহণ করা হয়েছে।",
        order: {
          id: existingOrder.id,
          orderId: existingOrder.orderId,
          invoiceId: existingOrder.invoiceId,
          customerName: existingOrder.customerName,
          phone: existingOrder.phone,
          subtotal: existingOrder.subtotal.toString(),
          deliveryCharge: existingOrder.deliveryCharge.toString(),
          totalAmount: existingOrder.totalAmount.toString(),
          orderStatus: existingOrder.orderStatus,
          createdAt: existingOrder.createdAt.toISOString(),
          metaEventId:
            existingOrder.metaPurchaseEventId ??
            existingOrder.checkoutRequestId ??
            `purchase_${existingOrder.id}`,
          items: existingOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        },
      });
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const [reel, shopSetting] = await Promise.all([
          transaction.reelProduct.findFirst({
            where: {
              id: reelId,
              status: true,

              category: {
                slug: categorySlug,
                status: true,

                source: {
                  status: true,
                },

                page: {
                  status: true,
                },
              },

              product: {
                status: true,
              },
            },

            select: {
              id: true,
              title: true,

              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  quantity: true,
                  sellingPrice: true,
                },
              },

              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sourceId: true,
                  pageId: true,

                  page: {
                    select: {
                      id: true,
                      prefixCode: true,
                    },
                  },
                },
              },
            },
          }),

          transaction.shopSetting.upsert({
            where: {
              id: SHOP_SETTING_ID,
            },
            update: {},
            create: {
              id: SHOP_SETTING_ID,
              insideDhakaDeliveryCharge:
                DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE,
              outsideDhakaDeliveryCharge:
                DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE,
              metaPixelId: null,
              metaPixelEnabled: false,
            },
            select: {
              insideDhakaDeliveryCharge: true,
              outsideDhakaDeliveryCharge: true,
              metaPixelId: true,
              metaConversionsApiEnabled: true,
              metaTestEventCode: true,
              metaConversionsAccessTokenEncrypted: true,
              metaConversionsAccessTokenIv: true,
              metaConversionsAccessTokenTag: true,
            },
          }),
        ]);

        if (!reel || !reel.category.slug) {
          throw new Error("REEL_NOT_FOUND");
        }

        if (reel.product.quantity < 1) {
          throw new Error("PRODUCT_OUT_OF_STOCK");
        }

        if (quantity > reel.product.quantity) {
          throw new Error("QUANTITY_EXCEEDS_STOCK");
        }

        const unitPrice = Number(
          reel.product.sellingPrice.toString()
        );

        if (
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {
          throw new Error("INVALID_PRODUCT_PRICE");
        }

        const insideDhakaDeliveryCharge = Number(
          shopSetting.insideDhakaDeliveryCharge.toString()
        );

        const outsideDhakaDeliveryCharge = Number(
          shopSetting.outsideDhakaDeliveryCharge.toString()
        );

        if (
          !Number.isFinite(
            insideDhakaDeliveryCharge
          ) ||
          insideDhakaDeliveryCharge < 0 ||
          !Number.isFinite(
            outsideDhakaDeliveryCharge
          ) ||
          outsideDhakaDeliveryCharge < 0
        ) {
          throw new Error(
            "INVALID_DELIVERY_SETTINGS"
          );
        }

        const deliveryCharge =
          deliveryArea === "INSIDE_DHAKA"
            ? insideDhakaDeliveryCharge
            : outsideDhakaDeliveryCharge;

        const subtotal = unitPrice * quantity;
        const totalAmount =
          subtotal + deliveryCharge;

        const updatedPage =
          await transaction.page.update({
            where: {
              id: reel.category.page.id,
            },

            data: {
              lastInvoiceSerial: {
                increment: 1,
              },
            },

            select: {
              prefixCode: true,
              lastInvoiceSerial: true,
            },
          });

        const invoiceId = createInvoiceId(
          updatedPage.prefixCode,
          updatedPage.lastInvoiceSerial
        );

        const orderId = createOrderId();
        const databaseOrderId = randomUUID();
        const metaPurchaseEventId = eventId;

        const note = createOrderNote({
          categoryName: reel.category.name,
          categorySlug: reel.category.slug,
          reelTitle: reel.title,
          deliveryArea,
          customerNote,
        });

        const order =
          await transaction.order.create({
            data: {
              id: databaseOrderId,
              orderId,
              invoiceId,
              checkoutRequestId,
              metaPurchaseEventId,
              metaPurchaseStatus: "PENDING",

              sourceId:
                reel.category.sourceId,
              pageId: reel.category.pageId,

              customerName,
              phone,
              address,

              subtotal: subtotal.toFixed(2),
              discount: "0.00",
              advance: "0.00",
              deliveryCharge:
                deliveryCharge.toFixed(2),
              totalAmount:
                totalAmount.toFixed(2),

              orderStatus:
                "PENDING_CONFIRMATION",

              note,

              items: {
                create: {
                  productId: reel.product.id,
                  productSku:
                    reel.product.sku,
                  productName:
                    reel.product.name,
                  quantity,
                  unitPrice:
                    unitPrice.toFixed(2),
                  lineTotal:
                    subtotal.toFixed(2),
                },
              },
            },

            select: {
              id: true,
              orderId: true,
              invoiceId: true,
              customerName: true,
              phone: true,
              subtotal: true,
              deliveryCharge: true,
              totalAmount: true,
              orderStatus: true,
              createdAt: true,
              metaPurchaseEventId: true,
              metaPurchaseSentAt: true,
              metaPurchaseStatus: true,

              items: {
                select: {
                  id: true,
                  productId: true,
                  productSku: true,
                  productName: true,
                  quantity: true,
                  unitPrice: true,
                  lineTotal: true,
                },
              },
            },
          });

        return {
          id: order.id,
          orderId: order.orderId,
          invoiceId: order.invoiceId,
          customerName: order.customerName,
          phone: order.phone,
          subtotal:
            order.subtotal.toString(),
          deliveryCharge:
            order.deliveryCharge.toString(),
          totalAmount:
            order.totalAmount.toString(),
          orderStatus: order.orderStatus,
          createdAt:
            order.createdAt.toISOString(),
          metaEventId:
            order.metaPurchaseEventId ??
            checkoutRequestId,

          meta: {
            pixelId: shopSetting.metaPixelId,
            enabled: shopSetting.metaConversionsApiEnabled,
            testEventCode: shopSetting.metaTestEventCode,
            metaConversionsAccessTokenEncrypted: shopSetting.metaConversionsAccessTokenEncrypted,
            metaConversionsAccessTokenIv: shopSetting.metaConversionsAccessTokenIv,
            metaConversionsAccessTokenTag: shopSetting.metaConversionsAccessTokenTag,
            productId: reel.product.sku,
            productName: reel.product.name,
            quantity,
          },

          items: order.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productSku: item.productSku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice:
              item.unitPrice.toString(),
            lineTotal:
              item.lineTotal.toString(),
          })),
        };
      },
      {
        maxWait: 5_000,
        timeout: 10_000,
      }
    );

    let accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() || "";

    if (
      result.meta.metaConversionsAccessTokenEncrypted &&
      result.meta.metaConversionsAccessTokenIv &&
      result.meta.metaConversionsAccessTokenTag
    ) {
      try {
        const { decryptSecret } = await import("@/lib/shop-settings-crypto");
        accessToken = decryptSecret({
          encrypted: result.meta.metaConversionsAccessTokenEncrypted,
          iv: result.meta.metaConversionsAccessTokenIv,
          tag: result.meta.metaConversionsAccessTokenTag,
        });
      } catch (tokenError) {
        console.error("Failed to decrypt Meta CAPI access token:", tokenError);
      }
    }

    if (result.meta.enabled && result.meta.pixelId && accessToken) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      const clientIpAddress = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
      const clientUserAgent = request.headers.get("user-agent");
      const sourceUrl = eventSourceUrl || request.headers.get("referer") || "";

      try {
        const { sendMetaPurchase } = await import("@/lib/meta/purchase");
        const metaResponse = await sendMetaPurchase({
          pixelId: result.meta.pixelId,
          accessToken,
          testEventCode: process.env.META_TEST_EVENT_CODE || result.meta.testEventCode,
          eventId: result.metaEventId,
          eventSourceUrl: sourceUrl,
          customerName,
          phone,
          clientIpAddress,
          clientUserAgent,
          fbp,
          fbc,
          value: Number(result.totalAmount),
          currency: "BDT",
          productId: result.meta.productId,
          productName: result.meta.productName,
          quantity: result.meta.quantity,
          orderId: result.orderId || result.id,
        });

        await prisma.order.update({
          where: { id: result.id },
          data: {
            metaPurchaseSentAt: new Date(),
            metaPurchaseStatus: "SENT",
            metaPurchaseError: null,
            metaPurchaseResponse: JSON.stringify(metaResponse).slice(0, 65000),
          },
        });
      } catch (metaError) {
        const metaMessage =
          metaError instanceof Error
            ? metaError.message
            : "Unknown Meta CAPI error";

        console.error("Meta Conversions API Purchase failed:", metaError);

        await prisma.order.update({
          where: { id: result.id },
          data: {
            metaPurchaseStatus: "FAILED",
            metaPurchaseError: metaMessage.slice(0, 65000),
          },
        }).catch((auditError) => {
          console.error("Failed to save Meta CAPI audit status:", auditError);
        });
      }
    }

    const publicResult = Object.fromEntries(
      Object.entries(result).filter(([key]) => key !== "meta")
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।",
        order: publicResult,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (prismaCode === "P2002" && replayCheckoutRequestId) {
      const replayOrder = await prisma.order.findUnique({
        where: { checkoutRequestId: replayCheckoutRequestId },
        select: {
          id: true,
          orderId: true,
          invoiceId: true,
          customerName: true,
          phone: true,
          subtotal: true,
          deliveryCharge: true,
          totalAmount: true,
          orderStatus: true,
          createdAt: true,
          checkoutRequestId: true,
          metaPurchaseEventId: true,
          items: {
            select: {
              id: true,
              productId: true,
              productSku: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
          },
        },
      });

      if (replayOrder) {
        return NextResponse.json({
          success: true,
          idempotentReplay: true,
          message: "এই অর্ডারটি ইতোমধ্যে গ্রহণ করা হয়েছে।",
          order: {
            id: replayOrder.id,
            orderId: replayOrder.orderId,
            invoiceId: replayOrder.invoiceId,
            customerName: replayOrder.customerName,
            phone: replayOrder.phone,
            subtotal: replayOrder.subtotal.toString(),
            deliveryCharge: replayOrder.deliveryCharge.toString(),
            totalAmount: replayOrder.totalAmount.toString(),
            orderStatus: replayOrder.orderStatus,
            createdAt: replayOrder.createdAt.toISOString(),
            metaEventId:
              replayOrder.metaPurchaseEventId ??
              replayOrder.checkoutRequestId ??
              `purchase_${replayOrder.id}`,
            items: replayOrder.items.map((item) => ({
              ...item,
              unitPrice: item.unitPrice.toString(),
              lineTotal: item.lineTotal.toString(),
            })),
          },
        });
      }
    }

    if (error instanceof Error) {
      if (error.message === "REEL_NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            message:
              "এই পণ্যটি বর্তমানে অর্ডারের জন্য পাওয়া যাচ্ছে না।",
          },
          {
            status: 404,
          }
        );
      }

      if (
        error.message ===
        "PRODUCT_OUT_OF_STOCK"
      ) {
        return NextResponse.json(
          {
            success: false,
            field: "quantity",
            message:
              "দুঃখিত, পণ্যটি বর্তমানে স্টকে নেই।",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.message ===
        "QUANTITY_EXCEEDS_STOCK"
      ) {
        return NextResponse.json(
          {
            success: false,
            field: "quantity",
            message:
              "আপনার নির্বাচিত পরিমাণ বর্তমানে স্টকে নেই।",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.message ===
        "INVALID_PRODUCT_PRICE"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "পণ্যের মূল্য সঠিকভাবে নির্ধারিত নেই।",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.message ===
        "INVALID_DELIVERY_SETTINGS"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Delivery charge settings সঠিক নয়। Admin-এর সঙ্গে যোগাযোগ করুন।",
          },
          {
            status: 409,
          }
        );
      }
    }

    console.error(
      "Failed to create public reel order:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "অর্ডারটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
      },
      {
        status: 500,
      }
    );
  }
}