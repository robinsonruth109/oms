export type MetaFunnelEventName = "AddToCart" | "InitiateCheckout";

type SendMetaFunnelEventInput = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  eventName: MetaFunnelEventName;
  eventId: string;
  eventSourceUrl: string;
  sku: string;
  parentSku?: string | null;
  productName: string;
  quantity: number;
  value: number;
  currency?: string;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

function normalizeCurrency(currency?: string) {
  const normalized = (currency ?? "BDT").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "BDT";
}

function normalizeMoney(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Meta funnel value must be a finite, non-negative number.");
  }

  return Math.round(value * 100) / 100;
}

export async function sendMetaFunnelEvent(input: SendMetaFunnelEventInput) {
  const quantity = Math.max(1, Math.trunc(input.quantity));
  const value = normalizeMoney(input.value);
  const currency = normalizeCurrency(input.currency);
  const unitPrice = Math.round((value / quantity) * 100) / 100;

  const userData: Record<string, unknown> = {};

  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_type: "product",
          content_ids: [input.sku],
          contents: [
            {
              id: input.sku,
              quantity,
              item_price: unitPrice,
            },
          ],
          content_name: input.productName,
          ...(input.parentSku ? { item_group_id: input.parentSku } : {}),
        },
      },
    ],
  };

  if (input.testEventCode) payload.test_event_code = input.testEventCode;

  const graphVersion = process.env.FB_GRAPH_VERSION?.trim() || "v23.0";
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(input.pixelId)}/events?access_token=${encodeURIComponent(input.accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Meta CAPI ${input.eventName} failed (${response.status}): ${await response.text()}`);
  }

  return response.json() as Promise<unknown>;
}
