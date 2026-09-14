const FINAL_RETURN_MARKERS = [
  "return-id-created",
  "return id created",
  "return_in_transit",
  "return-in-transit",
  "return in transit",
  "returned-to-merchant",
  "returned to merchant",
  "paid-return",
  "paid return",
  "return completed",
  "return complete",
];

const REQUEST_MARKERS = [
  "return requested",
  "return-requested",
  "return_requested",
  "requested return",
];

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isFinalPathaoReturnState(
  status: string | null | undefined,
  statusSlug: string | null | undefined,
  latestEventName?: string | null
) {
  const combined = [status, statusSlug, latestEventName]
    .map(normalize)
    .filter(Boolean)
    .join(" ");

  return FINAL_RETURN_MARKERS.some((marker) => combined.includes(marker));
}

/**
 * Pathao's Merchant Panel calls this workflow "Return Requested". Depending on
 * whether the value reached OMS via order-info or webhook, the current state can
 * arrive as "Return Requested", "Return" or webhook event "order.returned".
 * Once a reverse-return lifecycle event starts, the parcel is no longer treated
 * as an actionable Return Requested item.
 */
export function isPathaoReturnRequestedState(
  status: string | null | undefined,
  statusSlug: string | null | undefined,
  latestEventName?: string | null
) {
  if (isFinalPathaoReturnState(status, statusSlug, latestEventName)) {
    return false;
  }

  const values = [status, statusSlug, latestEventName]
    .map(normalize)
    .filter(Boolean);

  if (values.some((value) => REQUEST_MARKERS.some((marker) => value.includes(marker)))) {
    return true;
  }

  // Pathao's official WooCommerce mapping converts the webhook event
  // `order.returned` to the API/UI lifecycle status `Return`. Do not treat
  // generic `Returned` as Return Requested because it can be confused with
  // a later completed-return state.
  return values.some((value) =>
    ["return", "order.returned"].includes(value)
  );
}

export function isReturnRequestedWebhookEvent(eventName: string | null | undefined) {
  const value = normalize(eventName);
  return value === "order.returned" || REQUEST_MARKERS.some((marker) => value.includes(marker));
}
