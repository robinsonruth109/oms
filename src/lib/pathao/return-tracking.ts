import { prisma } from "@/lib/prisma";
import { getPathaoOrderInfo } from "./client";
import { extractPathaoWebhookFields } from "./webhook";
import type { PathaoOrderInfo } from "./types";

export type PathaoReturnCourierMatch = {
  courierId: string;
  courierName: string;
  courierSlug: string;
  merchantOrderId: string;
  pathaoStatus: string | null;
  pathaoStatusSlug: string | null;
  outboundConsignmentId: string | null;
  source: "RETURN_WEBHOOK" | "ORDER_INFO";
  info: PathaoOrderInfo;
};

const RETURN_WEBHOOK_EVENTS = [
  "order.return-id-created",
  "order.return-in-transit",
  "order.returned-to-merchant",
];

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown Pathao error");
}

function returnEventLabel(eventName: string) {
  switch (eventName) {
    case "order.return-id-created":
      return "Return ID Created";
    case "order.return-in-transit":
      return "Return In Transit";
    case "order.returned-to-merchant":
      return "Returned To Merchant";
    default:
      return eventName;
  }
}

export function pathaoMerchantOrderId(info: PathaoOrderInfo) {
  return cleanText(info.merchant_order_id) || cleanText(info.invoice_id);
}

export function pathaoStatusLabel(info: PathaoOrderInfo) {
  return cleanText(info.order_status) || cleanText(info.order_status_slug);
}

async function originalOutboundForOrder(
  orderId: string | null | undefined,
  fallback: string | null
) {
  if (!orderId) return fallback;

  const firstOutboundEvent = await prisma.pathaoWebhookEvent.findFirst({
    where: {
      orderId,
      signatureValid: true,
      consignmentId: { not: null },
      eventName: { notIn: RETURN_WEBHOOK_EVENTS },
    },
    orderBy: { receivedAt: "asc" },
    select: { consignmentId: true },
  });

  return cleanText(firstOutboundEvent?.consignmentId) || fallback;
}

async function findReturnWebhookMatch(returnConsignmentId: string) {
  const normalized = normalizeId(returnConsignmentId);

  const direct = await prisma.pathaoWebhookEvent.findFirst({
    where: {
      signatureValid: true,
      returnConsignmentId: normalized,
      courier: { is: { status: true, pathaoEnabled: true } },
    },
    orderBy: { receivedAt: "desc" },
    include: {
      courier: { select: { id: true, name: true, slug: true } },
      order: { select: { invoiceId: true, pathaoConsignmentId: true } },
    },
  });

  const candidates = direct
    ? [direct]
    : await prisma.pathaoWebhookEvent.findMany({
        where: {
          signatureValid: true,
          eventName: { in: RETURN_WEBHOOK_EVENTS },
          courier: { is: { status: true, pathaoEnabled: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 5000,
        include: {
          courier: { select: { id: true, name: true, slug: true } },
          order: { select: { invoiceId: true, pathaoConsignmentId: true } },
        },
      });

  for (const event of candidates) {
    const fields = extractPathaoWebhookFields(event.rawPayload);
    const explicitReturnId = normalizeId(
      event.returnConsignmentId || fields.returnConsignmentId
    );
    const eventConsignmentId = normalizeId(
      event.consignmentId || fields.consignmentId
    );
    const isReturnLifecycleEvent = RETURN_WEBHOOK_EVENTS.includes(event.eventName);

    const matchedAsExplicitReturn =
      Boolean(explicitReturnId) && explicitReturnId === normalized;
    const matchedAsReturnLifecycleConsignment =
      !explicitReturnId &&
      isReturnLifecycleEvent &&
      eventConsignmentId === normalized;

    if (!matchedAsExplicitReturn && !matchedAsReturnLifecycleConsignment) {
      continue;
    }

    let outboundConsignmentId = matchedAsExplicitReturn
      ? cleanText(event.consignmentId) || cleanText(fields.consignmentId)
      : null;

    outboundConsignmentId = await originalOutboundForOrder(
      event.orderId,
      outboundConsignmentId || cleanText(event.order?.pathaoConsignmentId)
    );

    let merchantOrderId =
      cleanText(event.merchantOrderId) ||
      cleanText(fields.merchantOrderId) ||
      cleanText(event.order?.invoiceId);

    let fallbackInfo: PathaoOrderInfo | null = null;

    if (!merchantOrderId && outboundConsignmentId) {
      try {
        fallbackInfo = await getPathaoOrderInfo(
          event.courier.id,
          outboundConsignmentId
        );
        merchantOrderId = pathaoMerchantOrderId(fallbackInfo);
      } catch {
        // Try another verified return webhook row.
      }
    }

    if (!merchantOrderId) continue;

    const pathaoStatus =
      cleanText(fields.orderStatus) ||
      cleanText(fallbackInfo?.order_status) ||
      returnEventLabel(event.eventName);
    const pathaoStatusSlug =
      cleanText(fields.orderStatusSlug) ||
      cleanText(fallbackInfo?.order_status_slug) ||
      cleanText(event.eventName);

    return {
      courierId: event.courier.id,
      courierName: event.courier.name,
      courierSlug: event.courier.slug,
      merchantOrderId,
      pathaoStatus,
      pathaoStatusSlug,
      outboundConsignmentId,
      source: "RETURN_WEBHOOK" as const,
      info: {
        ...(fallbackInfo || {}),
        consignment_id: outboundConsignmentId || undefined,
        return_consignment_id: normalized,
        merchant_order_id: merchantOrderId,
        order_status: pathaoStatus,
        order_status_slug: pathaoStatusSlug,
      } satisfies PathaoOrderInfo,
    } satisfies PathaoReturnCourierMatch;
  }

  // Some Pathao return-leg updates can arrive with the new barcode in
  // consignment_id. If that event is linked to an OMS order, compare it with
  // the order's earliest verified outbound event. A different later
  // consignment is treated as the return leg; the true outbound ID is rejected.
  const linkedReturnLegEvents = await prisma.pathaoWebhookEvent.findMany({
    where: {
      signatureValid: true,
      consignmentId: normalized,
      orderId: { not: null },
      courier: { is: { status: true, pathaoEnabled: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
    include: {
      courier: { select: { id: true, name: true, slug: true } },
      order: { select: { invoiceId: true, pathaoConsignmentId: true } },
    },
  });

  for (const event of linkedReturnLegEvents) {
    const outboundConsignmentId = await originalOutboundForOrder(
      event.orderId,
      cleanText(event.order?.pathaoConsignmentId)
    );

    if (
      !outboundConsignmentId ||
      normalizeId(outboundConsignmentId) === normalized ||
      !event.order?.invoiceId
    ) {
      continue;
    }

    const fields = extractPathaoWebhookFields(event.rawPayload);
    const pathaoStatus =
      cleanText(fields.orderStatus) || returnEventLabel(event.eventName);
    const pathaoStatusSlug =
      cleanText(fields.orderStatusSlug) || cleanText(event.eventName);

    return {
      courierId: event.courier.id,
      courierName: event.courier.name,
      courierSlug: event.courier.slug,
      merchantOrderId: event.order.invoiceId,
      pathaoStatus,
      pathaoStatusSlug,
      outboundConsignmentId,
      source: "RETURN_WEBHOOK" as const,
      info: {
        consignment_id: outboundConsignmentId,
        return_consignment_id: normalized,
        merchant_order_id: event.order.invoiceId,
        order_status: pathaoStatus,
        order_status_slug: pathaoStatusSlug,
      } satisfies PathaoOrderInfo,
    } satisfies PathaoReturnCourierMatch;
  }

  return null;
}

export async function searchAllPathaoCouriersForConsignment(
  consignmentId: string
) {
  const normalizedConsignmentId = normalizeId(consignmentId);

  const couriers = await prisma.courier.findMany({
    where: {
      status: true,
      pathaoEnabled: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const webhookMatch = await findReturnWebhookMatch(normalizedConsignmentId);
  if (webhookMatch) {
    return {
      checkedCourierCount: couriers.length,
      matches: [webhookMatch],
      errors: [] as { courierId: string; courierName: string; message: string }[],
    };
  }

  const results = await Promise.all(
    couriers.map(async (courier) => {
      try {
        const info = await getPathaoOrderInfo(courier.id, normalizedConsignmentId);
        const merchantOrderId = pathaoMerchantOrderId(info);

        if (!merchantOrderId) {
          return {
            type: "EMPTY" as const,
            courier,
          };
        }

        return {
          type: "MATCH" as const,
          match: {
            courierId: courier.id,
            courierName: courier.name,
            courierSlug: courier.slug,
            merchantOrderId,
            pathaoStatus: cleanText(info.order_status),
            pathaoStatusSlug: cleanText(info.order_status_slug),
            outboundConsignmentId: cleanText(info.consignment_id),
            source: "ORDER_INFO" as const,
            info,
          } satisfies PathaoReturnCourierMatch,
        };
      } catch (error) {
        return {
          type: "ERROR" as const,
          courier,
          error: errorText(error),
        };
      }
    })
  );

  const matches: PathaoReturnCourierMatch[] = [];
  const errors: { courierId: string; courierName: string; message: string }[] = [];

  for (const result of results) {
    if (result.type === "MATCH") {
      matches.push(result.match);
    } else if (result.type === "ERROR") {
      errors.push({
        courierId: result.courier.id,
        courierName: result.courier.name,
        message: result.error,
      });
    }
  }

  return {
    checkedCourierCount: couriers.length,
    matches,
    errors,
  };
}
