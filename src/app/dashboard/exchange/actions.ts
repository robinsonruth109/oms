"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import {
  bangladeshBusinessDateToUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { getPathaoOrderInfo } from "@/lib/pathao/client";

type ExchangeActionState = {
  success: boolean;
  message: string;
  exchangeCaseId?: string;
  exchangeCode?: string;
  memoOrderId?: string;
};

type ExpectedReturnInput = {
  orderItemId: string;
  quantity: number;
};

type OutgoingInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

const ALL_EXCHANGE_ROLES = [
  "ADMIN",
  "AGENT",
  "NOTE_AGENT",
  "PACKAGING_AGENT",
];

async function requireExchangeAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !ALL_EXCHANGE_ROLES.includes(session.user.role)) {
    throw new Error("Unauthorized action.");
  }
  return session;
}

function normalizeCid(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function cleanText(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function parseJsonArray<T>(value: FormDataEntryValue | null): T[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function positiveInt(value: unknown) {
  const n = Math.trunc(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatTk(value: number) {
  return `Tk ${value.toFixed(2)}`;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code || "") === "P2002"
  );
}

export async function issueExchangeAction(
  _prevState: ExchangeActionState,
  formData: FormData
): Promise<ExchangeActionState> {
  try {
    const session = await requireExchangeAccess();
    const { prisma } = await import("@/lib/prisma");

    const originalOrderId = cleanText(formData.get("originalOrderId"), 191);
    const exchangeCid = normalizeCid(formData.get("pathaoExchangeConsignmentId"));
    const reason = cleanText(formData.get("reason"), 2000);
    const note = cleanText(formData.get("note"), 4000);
    const exchangeDeliveryCharge = money(formData.get("exchangeDeliveryCharge"));

    const expectedReturns = parseJsonArray<ExpectedReturnInput>(
      formData.get("expectedReturns")
    )
      .map((item) => ({
        orderItemId: cleanText(item?.orderItemId, 191),
        quantity: positiveInt(item?.quantity),
      }))
      .filter((item) => item.orderItemId && item.quantity > 0);

    const outgoing = parseJsonArray<OutgoingInput>(formData.get("outgoingItems"))
      .map((item) => ({
        productId: cleanText(item?.productId, 191),
        quantity: positiveInt(item?.quantity),
        unitPrice: money(item?.unitPrice),
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (!originalOrderId) {
      return { success: false, message: "Select an original OMS order first." };
    }
    if (!exchangeCid) {
      return {
        success: false,
        message: "Enter the Pathao Exchange Parcel / Consignment ID.",
      };
    }
    if (exchangeCid.length < 6 || exchangeCid.length > 80) {
      return { success: false, message: "Pathao Exchange ID looks invalid." };
    }
    if (!reason) {
      return { success: false, message: "Exchange reason is required." };
    }
    if (!expectedReturns.length) {
      return {
        success: false,
        message: "Select at least one product that is expected back from the customer.",
      };
    }
    if (!outgoing.length) {
      return {
        success: false,
        message: "Add at least one product to send in the exchange memo.",
      };
    }

    const original = await prisma.order.findUnique({
      where: { id: originalOrderId },
      include: {
        items: true,
        pathaoCourier: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            pathaoEnabled: true,
          },
        },
      },
    });

    if (!original || !original.invoiceId) {
      return { success: false, message: "Original OMS order was not found." };
    }

    if (!original.pathaoConsignmentId) {
      return {
        success: false,
        message:
          "This order is not linked to a Pathao consignment. Create/confirm the Pathao order first.",
      };
    }

    const fallbackPathaoCourier =
      !original.pathaoCourierId && original.courier
        ? await prisma.courier.findFirst({
            where: {
              slug: original.courier,
              status: true,
              pathaoEnabled: true,
            },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              pathaoEnabled: true,
            },
          })
        : null;
    const resolvedPathaoCourier = original.pathaoCourier || fallbackPathaoCourier;
    const resolvedPathaoCourierId =
      original.pathaoCourierId || fallbackPathaoCourier?.id || null;

    if (
      !resolvedPathaoCourierId ||
      !resolvedPathaoCourier?.status ||
      !resolvedPathaoCourier.pathaoEnabled
    ) {
      return {
        success: false,
        message: "The original order's Pathao courier is inactive or not configured.",
      };
    }

    if (normalizeCid(original.pathaoConsignmentId) === exchangeCid) {
      return {
        success: false,
        message:
          "The Exchange ID cannot be the same as the original outbound Pathao consignment ID.",
      };
    }

    const [existingCase, existingOrderCid] = await Promise.all([
      prisma.exchangeCase.findUnique({
        where: { pathaoExchangeConsignmentId: exchangeCid },
        select: { exchangeCode: true },
      }),
      prisma.order.findUnique({
        where: { pathaoConsignmentId: exchangeCid },
        select: { invoiceId: true, orderKind: true },
      }),
    ]);

    if (existingCase) {
      return {
        success: false,
        message: `${exchangeCid} is already used by exchange ${existingCase.exchangeCode}.`,
      };
    }
    if (existingOrderCid) {
      return {
        success: false,
        message: `${exchangeCid} is already linked to OMS invoice ${
          existingOrderCid.invoiceId || "Unknown"
        }.`,
      };
    }

    const originalItemMap = new Map(original.items.map((item) => [item.id, item]));
    const expectedByItem = new Map<string, number>();

    for (const row of expectedReturns) {
      const item = originalItemMap.get(row.orderItemId);
      if (!item) {
        return {
          success: false,
          message: "One of the selected return products does not belong to the original order.",
        };
      }

      const nextQty = (expectedByItem.get(item.id) || 0) + row.quantity;
      if (nextQty > item.quantity) {
        return {
          success: false,
          message: `${item.productSku} can be marked for return up to ${item.quantity} pcs.`,
        };
      }
      expectedByItem.set(item.id, nextQty);
    }

    const outgoingByProduct = new Map<
      string,
      { quantity: number; unitPrice: number }
    >();
    for (const row of outgoing) {
      const existing = outgoingByProduct.get(row.productId);
      if (existing && Math.abs(existing.unitPrice - row.unitPrice) > 0.001) {
        return {
          success: false,
          message: "The same outgoing product cannot have two different unit prices.",
        };
      }
      outgoingByProduct.set(row.productId, {
        quantity: (existing?.quantity || 0) + row.quantity,
        unitPrice: row.unitPrice,
      });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: [...outgoingByProduct.keys()] }, status: true },
      select: { id: true, sku: true, name: true, sellingPrice: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    if (products.length !== outgoingByProduct.size) {
      return {
        success: false,
        message: "One or more outgoing products are missing/inactive in Product Master.",
      };
    }

    let returnedCredit = 0;
    const expectedItemData = [...expectedByItem.entries()].map(
      ([orderItemId, quantity]) => {
        const item = originalItemMap.get(orderItemId)!;
        const unitPrice = Number(item.unitPrice);
        const lineTotal = money(unitPrice * quantity);
        returnedCredit += lineTotal;
        return {
          kind: "EXPECTED_RETURN" as const,
          originalOrderItemId: item.id,
          productId: item.productId,
          productSkuSnapshot: item.productSku,
          productNameSnapshot: item.productName,
          quantity,
          unitPrice,
          lineTotal,
        };
      }
    );

    let outgoingSubtotal = 0;
    const outgoingItemData = [...outgoingByProduct.entries()].map(
      ([productId, row]) => {
        const product = productMap.get(productId)!;
        const unitPrice = row.unitPrice;
        const lineTotal = money(unitPrice * row.quantity);
        outgoingSubtotal += lineTotal;
        return {
          kind: "OUTGOING" as const,
          originalOrderItemId: null,
          productId: product.id,
          productSkuSnapshot: product.sku,
          productNameSnapshot: product.name,
          quantity: row.quantity,
          unitPrice,
          lineTotal,
        };
      }
    );

    returnedCredit = money(returnedCredit);
    outgoingSubtotal = money(outgoingSubtotal);
    const priceDifference = money(Math.max(0, outgoingSubtotal - returnedCredit));
    const rawNet = money(outgoingSubtotal + exchangeDeliveryCharge) - returnedCredit;
    const amountToCollect = money(Math.max(0, rawNet));
    const customerCredit = money(Math.max(0, -rawNet));

    const lastCase = await prisma.exchangeCase.findFirst({
      where: { originalOrderId: original.id },
      orderBy: { sequenceNo: "desc" },
      select: { sequenceNo: true },
    });
    const sequenceNo = (lastCase?.sequenceNo || 0) + 1;
    const exchangeCode = `EX-${original.invoiceId}-${String(sequenceNo).padStart(2, "0")}`;

    const today = getBangladeshDateInputValue();
    const readyToShipAt = bangladeshBusinessDateToUtc(today);
    const expectedSummary = expectedItemData
      .map((item) => `${item.productSkuSnapshot} x${item.quantity}`)
      .join(", ");

    const memoNote = [
      `EXCHANGE against ${original.invoiceId}.`,
      `Pathao Exchange CID: ${exchangeCid}.`,
      `Expected back: ${expectedSummary}.`,
      `Return credit: ${formatTk(returnedCredit)}.`,
      `Outgoing: ${formatTk(outgoingSubtotal)}.`,
      `Exchange delivery: ${formatTk(exchangeDeliveryCharge)}.`,
      `Amount to collect: ${formatTk(amountToCollect)}.`,
      customerCredit > 0 ? `Customer credit: ${formatTk(customerCredit)}.` : "",
      `Reason: ${reason}.`,
      note ? `Note: ${note}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const actorLabel =
      session.user.name || session.user.username || "OMS User";

    const result = await prisma.$transaction(async (tx) => {
      const memoOrder = await tx.order.create({
        data: {
          orderId: exchangeCode,
          invoiceId: exchangeCode,
          sourceId: original.sourceId,
          pageId: original.pageId,
          customerName: original.customerName,
          address: original.address,
          phone: original.phone,
          subtotal: outgoingSubtotal,
          discount: returnedCredit,
          advance: 0,
          deliveryCharge: exchangeDeliveryCharge,
          totalAmount: amountToCollect,
          orderStatus: "READY_TO_SHIP",
          orderKind: "EXCHANGE",
          courier: original.courier,
          note: memoNote,
          invoiceDownloaded: false,
          csvDownloaded: true,
          readyToShipAt,
          pathaoCourierId: resolvedPathaoCourierId,
          pathaoConsignmentId: exchangeCid,
          pathaoMerchantOrderId:
            original.pathaoMerchantOrderId || original.invoiceId,
          pathaoSubmissionStatus: "CONSIGNMENT_CREATED",
          pathaoOrderStatus: "Exchange created manually",
          pathaoOrderStatusSlug: "exchange.manual-created",
          pathaoAmountToCollect: amountToCollect,
          pathaoSubmittedAt: new Date(),
          pathaoCreatedAt: new Date(),
          items: {
            create: outgoingItemData.map((item) => ({
              productId: item.productId,
              productSku: item.productSkuSnapshot,
              productName: item.productNameSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        select: { id: true, invoiceId: true },
      });

      const exchangeCase = await tx.exchangeCase.create({
        data: {
          exchangeCode,
          sequenceNo,
          originalOrderId: original.id,
          exchangeOrderId: memoOrder.id,
          originalPathaoConsignmentId: original.pathaoConsignmentId,
          pathaoExchangeConsignmentId: exchangeCid,
          pathaoCourierIdSnapshot: resolvedPathaoCourierId,
          pathaoCourierNameSnapshot: resolvedPathaoCourier?.name || null,
          reason,
          note: note || null,
          returnedCredit,
          outgoingSubtotal,
          priceDifference,
          exchangeDeliveryCharge,
          amountToCollect,
          customerCredit,
          verificationStatus: "PENDING",
          verificationMessage:
            "Exchange was created manually in Pathao. Waiting for Pathao webhook or manual verification.",
          pathaoOrderStatus: "Exchange created manually",
          pathaoOrderStatusSlug: "exchange.manual-created",
          status: "ISSUED",
          createdByUserId: session.user.id,
          items: {
            create: [...expectedItemData, ...outgoingItemData],
          },
        },
        select: { id: true, exchangeCode: true },
      });

      await tx.orderAuditEvent.createMany({
        data: [
          {
            orderId: original.id,
            eventType: "EXCHANGE_ISSUED",
            title: `Exchange issued: ${exchangeCode}`,
            performedByUserId: session.user.id,
            actorLabel,
            details: {
              exchangeCode,
              exchangeOrderId: memoOrder.id,
              pathaoExchangeConsignmentId: exchangeCid,
              expectedReturn: expectedItemData.map((item) => ({
                sku: item.productSkuSnapshot,
                quantity: item.quantity,
              })),
              outgoing: outgoingItemData.map((item) => ({
                sku: item.productSkuSnapshot,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
              returnedCredit,
              outgoingSubtotal,
              exchangeDeliveryCharge,
              amountToCollect,
              customerCredit,
              reason,
              note,
            },
          },
          {
            orderId: memoOrder.id,
            eventType: "EXCHANGE_MEMO_CREATED",
            title: `Exchange memo created from ${original.invoiceId}`,
            performedByUserId: session.user.id,
            actorLabel,
            details: {
              exchangeCode,
              originalOrderId: original.id,
              originalInvoiceId: original.invoiceId,
              originalPathaoConsignmentId: original.pathaoConsignmentId,
              pathaoExchangeConsignmentId: exchangeCid,
              csvDownloaded: true,
              invoiceDownloaded: false,
            },
          },
        ],
      });

      return {
        exchangeCaseId: exchangeCase.id,
        exchangeCode: exchangeCase.exchangeCode,
        memoOrderId: memoOrder.id,
      };
    });

    revalidatePath("/dashboard/exchange");
    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/pathao-orders");
    revalidatePath("/dashboard/all-orders");
    revalidatePath(`/dashboard/all-orders/${original.id}`);

    return {
      success: true,
      message: `${result.exchangeCode} created. It is now READY_TO_SHIP, Non Invoiced and CSV Downloaded. Stock was not restored; receive the old product through Pathao Return Track when it physically arrives.`,
      ...result,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message:
          "Exchange could not be created because the Exchange ID/code was already used. Refresh and try again.",
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to issue exchange.",
    };
  }
}

export async function verifyExchangeCaseAction(
  _prevState: ExchangeActionState,
  formData: FormData
): Promise<ExchangeActionState> {
  try {
    await requireExchangeAccess();
    const { prisma } = await import("@/lib/prisma");
    const exchangeCaseId = cleanText(formData.get("exchangeCaseId"), 191);

    const exchangeCase = await prisma.exchangeCase.findUnique({
      where: { id: exchangeCaseId },
      include: {
        originalOrder: {
          select: {
            invoiceId: true,
            pathaoMerchantOrderId: true,
          },
        },
        exchangeOrder: {
          select: {
            id: true,
            pathaoCourierId: true,
            pathaoConsignmentId: true,
          },
        },
      },
    });

    if (!exchangeCase) {
      return { success: false, message: "Exchange case was not found." };
    }
    if (
      !exchangeCase.exchangeOrder.pathaoCourierId ||
      !exchangeCase.exchangeOrder.pathaoConsignmentId
    ) {
      return {
        success: false,
        message: "Exchange memo is not linked to a Pathao courier/CID.",
      };
    }

    try {
      const info = await getPathaoOrderInfo(
        exchangeCase.exchangeOrder.pathaoCourierId,
        exchangeCase.exchangeOrder.pathaoConsignmentId
      );
      const merchantId = cleanText(info.merchant_order_id, 191);
      const allowedMerchantIds = new Set(
        [
          exchangeCase.exchangeCode,
          exchangeCase.originalOrder.invoiceId,
          exchangeCase.originalOrder.pathaoMerchantOrderId,
        ].filter((value): value is string => Boolean(value))
      );

      if (merchantId && !allowedMerchantIds.has(merchantId)) {
        await prisma.exchangeCase.update({
          where: { id: exchangeCase.id },
          data: {
            verificationStatus: "FAILED",
            verificationMessage: `Pathao returned merchant order ID ${merchantId}, which does not match the original/exchange OMS invoice.`,
          },
        });
        revalidatePath("/dashboard/exchange");
        revalidatePath(`/dashboard/exchange/${exchangeCase.id}`);
        return {
          success: false,
          message: `Verification failed: Pathao merchant order ID ${merchantId} does not match this exchange.`,
        };
      }

      const status = cleanText(info.order_status, 191) || null;
      const statusSlug = cleanText(info.order_status_slug, 191) || null;
      const looksExchanged = `${status || ""} ${statusSlug || ""}`
        .toLowerCase()
        .includes("exchang");
      const now = new Date();

      await prisma.$transaction([
        prisma.exchangeCase.update({
          where: { id: exchangeCase.id },
          data: {
            verificationStatus: "VERIFIED",
            verificationMessage: "Verified from Pathao order info API.",
            pathaoOrderStatus: status,
            pathaoOrderStatusSlug: statusSlug,
            status: looksExchanged ? "PATHAO_EXCHANGED" : exchangeCase.status,
            completedAt: looksExchanged ? now : exchangeCase.completedAt,
          },
        }),
        prisma.order.update({
          where: { id: exchangeCase.exchangeOrder.id },
          data: {
            pathaoOrderStatus: status,
            pathaoOrderStatusSlug: statusSlug,
            pathaoLastSyncedAt: now,
            pathaoRawResponse: JSON.stringify(info),
            pathaoLastError: null,
          },
        }),
      ]);

      revalidatePath("/dashboard/exchange");
      revalidatePath(`/dashboard/exchange/${exchangeCase.id}`);
      revalidatePath("/dashboard/pathao-orders");

      return {
        success: true,
        message: `Pathao verified ${exchangeCase.exchangeCode}: ${
          status || statusSlug || "verified"
        }.` ,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pathao verification failed.";
      await prisma.exchangeCase.update({
        where: { id: exchangeCase.id },
        data: {
          verificationStatus: "PENDING",
          verificationMessage: `Pathao exchange CID is saved, but the public order-info API could not verify it yet. ${message}`,
        },
      });
      revalidatePath("/dashboard/exchange");
      revalidatePath(`/dashboard/exchange/${exchangeCase.id}`);
      return {
        success: false,
        message:
          "Exchange remains saved. Pathao's public order-info API could not verify this Exchange ID yet; webhook verification can still complete it later.",
      };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to verify exchange.",
    };
  }
}
