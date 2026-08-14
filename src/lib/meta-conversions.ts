// Backwards-compatible re-export. The Purchase implementation lives in
// src/lib/meta/purchase.ts and must keep Product.sku as productId.
export { sendMetaPurchase } from "@/lib/meta/purchase";
export type { MetaPurchaseInput } from "@/lib/meta/purchase";
