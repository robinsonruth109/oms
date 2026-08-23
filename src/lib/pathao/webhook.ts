type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findKeyRecursive(
  value: unknown,
  wanted: Set<string>,
  depth = 0
): unknown {
  if (depth > 6) return undefined;

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase())) {
        return child;
      }
    }

    for (const child of Object.values(value)) {
      const found = findKeyRecursive(child, wanted, depth + 1);
      if (found !== undefined) return found;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const found = findKeyRecursive(child, wanted, depth + 1);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

export function extractPathaoWebhookFields(payload: unknown) {
  const event =
    text(findKeyRecursive(payload, new Set(["event", "event_name", "eventname"]))) ||
    "unknown";

  const consignmentId = text(
    findKeyRecursive(
      payload,
      new Set(["consignment_id", "consignmentid", "consignment"])
    )
  );

  const merchantOrderId = text(
    findKeyRecursive(
      payload,
      new Set([
        "merchant_order_id",
        "merchantorderid",
        "merchant_order",
        "order_id",
      ])
    )
  );

  const orderStatus =
    text(
      findKeyRecursive(
        payload,
        new Set(["order_status", "orderstatus", "status"])
      )
    ) || (event !== "unknown" ? event : null);

  const orderStatusSlug = text(
    findKeyRecursive(
      payload,
      new Set(["order_status_slug", "orderstatusslug", "status_slug"])
    )
  );

  const deliveryFeeRaw = findKeyRecursive(
    payload,
    new Set(["delivery_fee", "deliveryfee"])
  );

  const deliveryFeeNumber =
    deliveryFeeRaw === undefined || deliveryFeeRaw === null
      ? null
      : Number(deliveryFeeRaw);

  return {
    event,
    consignmentId,
    merchantOrderId,
    orderStatus,
    orderStatusSlug,
    deliveryFee:
      deliveryFeeNumber !== null && Number.isFinite(deliveryFeeNumber)
        ? deliveryFeeNumber
        : null,
  };
}
