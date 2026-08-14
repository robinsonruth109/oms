import { createHash } from "node:crypto";
function sha256(value: string) { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex"); }
function normalizePhone(phone: string) { const digits = phone.replace(/\D/g, ""); return digits.startsWith("880")? digits : `88${digits}`; }
function normalizeCurrency(currency?: string) { const normalized = (currency?? "BDT").trim().toUpperCase(); return /^[A-Z]{3}$/.test(normalized)? normalized : "BDT"; }
function normalizeMoney(value: number) { if (!Number.isFinite(value) || value < 0) { throw new Error("Meta Purchase value must be a finite, non-negative number."); } return Math.round(value * 100) / 100; }
export type MetaPurchaseInput = { pixelId: string; accessToken: string; testEventCode?: string | null; eventId: string; eventSourceUrl: string; customerName: string; phone: string; clientIpAddress?: string | null; clientUserAgent?: string | null; fbp?: string | null; fbc?: string | null; value: number; currency?: string; productId: string; productName: string; quantity: number; orderId: string; };
export async function sendMetaPurchase(input: MetaPurchaseInput) {
  const value = normalizeMoney(input.value);
  const currency = normalizeCurrency(input.currency);
  const quantity = Math.max(1, Math.trunc(input.quantity));
  const nameParts = input.customerName.trim().split(/\s+/);
  const userData: Record<string, unknown> = { ph: [sha256(normalizePhone(input.phone))], };
  if (nameParts[0]) userData.fn = [sha256(nameParts[0])];
  if (nameParts.length > 1) userData.ln = [sha256(nameParts.slice(1).join(" "))];
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  const payload: Record<string, unknown> = { data: [{ event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: input.eventId, event_source_url: input.eventSourceUrl, action_source: "website", user_data: userData, custom_data: { value, currency, content_type: "product", content_ids: [input.productId], contents: [{ id: input.productId, quantity, item_price: Math.round((value / quantity) * 100) / 100 }], content_name: input.productName, order_id: input.orderId, }, }], };
  if (input.testEventCode) payload.test_event_code = input.testEventCode;
  const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(input.pixelId)}/events?access_token=${encodeURIComponent(input.accessToken)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  if (!response.ok) throw new Error(`Meta CAPI failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<unknown>;
}
