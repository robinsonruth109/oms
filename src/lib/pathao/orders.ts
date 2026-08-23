import type { PathaoOrderPayload, PreparedPathaoOrder } from "./types";
import { normalizeBangladeshPhone } from "@/lib/phone-normalization";

type OrderForPathao = {
  id: string;
  invoiceId: string | null;
  orderId: string | null;
  customerName: string;
  phone: string;
  address: string;
  note: string | null;
  totalAmount: unknown;
  items: {
    productSku: string;
    productName: string;
    quantity: number;
  }[];
};

export function normalizePathaoPhone(value: string) {
  return normalizeBangladeshPhone(value);
}

export function validatePathaoOrder(order: OrderForPathao) {
  const errors: string[] = [];
  const name = String(order.customerName || "").trim();
  const phone = normalizePathaoPhone(order.phone);
  const address = String(order.address || "").trim();

  if (name.length < 3 || name.length > 100) {
    errors.push("Recipient name must be 3-100 characters.");
  }

  if (!/^01\d{9}$/.test(phone)) {
    errors.push("Recipient phone must be a valid 11-digit Bangladesh mobile number.");
  }

  if (address.length < 10 || address.length > 220) {
    errors.push("Recipient address must be 10-220 characters.");
  }

  if (!order.invoiceId && !order.orderId) {
    errors.push("OMS invoice/order ID is missing.");
  }

  return errors;
}

export function preparePathaoOrder(
  order: OrderForPathao,
  storeId: number
): PreparedPathaoOrder {
  const validation = validatePathaoOrder(order);

  if (validation.length) {
    throw new Error(validation.join(" "));
  }

  const invoiceId = String(order.invoiceId || order.orderId || order.id);
  const itemQuantity = Math.max(
    1,
    order.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0)
  );

  const description = order.items
    .map((item) => `${item.productSku || item.productName} x${item.quantity}`)
    .join(", ")
    .slice(0, 500);

  const payload: PathaoOrderPayload = {
    store_id: storeId,
    merchant_order_id: invoiceId,
    recipient_name: String(order.customerName).trim(),
    recipient_phone: normalizePathaoPhone(order.phone),
    recipient_address: String(order.address).trim(),
    delivery_type: 48,
    item_type: 2,
    item_quantity: itemQuantity,
    item_weight: 0.5,
    amount_to_collect: Math.max(0, Math.round(Number(order.totalAmount || 0))),
  };

  const note = String(order.note || "").trim();
  if (note) payload.special_instruction = note.slice(0, 500);
  if (description) payload.item_description = description;

  return {
    orderId: order.id,
    invoiceId,
    payload,
  };
}
