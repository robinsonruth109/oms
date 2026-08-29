import { NextRequest, NextResponse } from "next/server";
import { decryptPathaoWebhookSecret } from "@/lib/pathao/crypto";
import { extractPathaoWebhookFields } from "@/lib/pathao/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PATHAO_INTEGRATION_RESPONSE_SECRET =
  "f3992ecc-59da-4cbe-a049-a13da2018d51";

const PATHAO_RETURN_LIFECYCLE_EVENTS = new Set([
  "order.return-id-created",
  "order.return-in-transit",
  "order.returned-to-merchant",
]);

function response202(
  headerSecret: string,
  body: Record<string, unknown>
) {
  return NextResponse.json(body, {
    status: 202,
    headers: {
      "Cache-Control": "no-store",
      "X-Pathao-Merchant-Webhook-Integration-Secret": headerSecret,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courierId: string }> }
) {
  const { courierId } = await context.params;
  const { prisma } = await import("@/lib/prisma");

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
  });

  if (!courier || !courier.pathaoEnabled) {
    return NextResponse.json(
      { success: false, message: "Courier webhook is not enabled." },
      { status: 404 }
    );
  }

  const secret = decryptPathaoWebhookSecret(courier);
  if (!secret) {
    return NextResponse.json(
      { success: false, message: "Webhook secret is not configured." },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON." },
      { status: 400 }
    );
  }

  const fields = extractPathaoWebhookFields(payload);

  // Pathao webhook integration verification requires its fixed response-header
  // value. This is separate from the merchant webhook secret used to validate
  // incoming X-PATHAO-Signature headers.
  if (fields.event === "webhook_integration") {
    return response202(PATHAO_INTEGRATION_RESPONSE_SECRET, {
      success: true,
      event: "webhook_integration",
    });
  }

  const signature =
    request.headers.get("x-pathao-signature") ||
    request.headers.get("X-PATHAO-Signature") ||
    "";

  if (signature !== secret) {
    await prisma.pathaoWebhookEvent.create({
      data: {
        courierId,
        eventName: fields.event,
        consignmentId: fields.consignmentId,
        returnConsignmentId: fields.returnConsignmentId,
        merchantOrderId: fields.merchantOrderId,
        signatureValid: false,
        processed: false,
        processingNote: "Rejected: X-PATHAO-Signature did not match configured secret.",
        rawPayload: payload as object,
      },
    });

    return NextResponse.json(
      { success: false, message: "Invalid Pathao signature." },
      { status: 401 }
    );
  }

  let order = null;

  const consignmentCandidates = [
    fields.consignmentId,
    fields.returnConsignmentId,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of consignmentCandidates) {
    order = await prisma.order.findUnique({
      where: { pathaoConsignmentId: candidate },
    });
    if (order) break;
  }

  if (!order && fields.merchantOrderId) {
    order = await prisma.order.findFirst({
      where: {
        OR: [
          { invoiceId: fields.merchantOrderId },
          { orderId: fields.merchantOrderId },
          { externalOrderId: fields.merchantOrderId },
          { pathaoMerchantOrderId: fields.merchantOrderId },
        ],
      },
    });
  }

  let processingNote = order ? "Matched and processed." : "Stored; OMS order not matched yet.";

  if (order) {
    const isReturnLifecycleEvent =
      PATHAO_RETURN_LIFECYCLE_EVENTS.has(fields.event) ||
      Boolean(fields.returnConsignmentId);

    const nextData: Record<string, unknown> = {
      pathaoCourierId: courierId,
      pathaoLastSyncedAt: new Date(),
      pathaoRawResponse: JSON.stringify(payload),
      pathaoLastError: null,
    };

    // Keep the original outbound consignment ID stable. Return lifecycle
    // webhooks can carry a different return-leg consignment ID.
    if (fields.consignmentId && !isReturnLifecycleEvent) {
      nextData.pathaoConsignmentId = fields.consignmentId;
      nextData.pathaoSubmissionStatus = "CONSIGNMENT_CREATED";
      nextData.pathaoCreatedAt = order.pathaoCreatedAt || new Date();
    }

    if (fields.merchantOrderId) {
      nextData.pathaoMerchantOrderId = fields.merchantOrderId;
    }

    if (fields.orderStatus) nextData.pathaoOrderStatus = fields.orderStatus;
    if (fields.orderStatusSlug) nextData.pathaoOrderStatusSlug = fields.orderStatusSlug;
    if (fields.deliveryFee !== null) nextData.pathaoDeliveryFee = fields.deliveryFee;
    if (fields.amountToCollect !== null) {
      nextData.pathaoAmountToCollect = fields.amountToCollect;
    }

    try {
      await prisma.order.update({
        where: { id: order.id },
        data: nextData,
      });
    } catch (error) {
      processingNote =
        error instanceof Error
          ? `Webhook stored but order update failed: ${error.message}`
          : "Webhook stored but order update failed.";
    }
  }

  await prisma.pathaoWebhookEvent.create({
    data: {
      courierId,
      orderId: order?.id || null,
      eventName: fields.event,
      consignmentId: fields.consignmentId,
      returnConsignmentId: fields.returnConsignmentId,
      merchantOrderId: fields.merchantOrderId,
      signatureValid: true,
      processed: Boolean(order),
      processingNote,
      rawPayload: payload as object,
    },
  });

  return response202(secret, {
    success: true,
    received: true,
  });
}
