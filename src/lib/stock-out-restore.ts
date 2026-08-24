import { bangladeshDateStartUtc } from "@/lib/bangladesh-time";
import { normalizeBangladeshPhone } from "@/lib/phone-normalization";

export type StockOutPreviewItem = {
  position: number;
  csvSku: string;
  csvParentCode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  suggestedProductId: string | null;
  suggestedProductSku: string | null;
  suggestedProductName: string | null;
  matchedBy: "EXACT_SKU" | "NORMALIZED_SKU" | "PARENT_CODE" | "NONE";
};

export type StockOutPreviewRow = {
  rowNumber: number;
  invoiceId: string;
  pageName: string;
  importedDate: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryCharge: number;
  discount: number;
  grandTotal: number;
  items: StockOutPreviewItem[];

  suggestedPageId: string | null;
  suggestedSourceId: string | null;
  suggestedCourierSlug: string | null;

  existingOrderId: string | null;
  existingOrderStatus: string | null;
  existingOrderCourier: string | null;

  action: "CREATE" | "RESTORE" | "BLOCKED";
  message: string;
};

export type StockOutCommitItem = {
  productId: string;
  csvSku: string;
  csvParentCode: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type StockOutCommitRow = {
  include: boolean;
  rowNumber: number;
  invoiceId: string;
  pageId: string;
  sourceId: string;
  courierSlug: string;
  importedDate: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryCharge: number;
  discount: number;
  grandTotal: number;
  action: "CREATE" | "RESTORE";
  existingOrderId: string | null;
  items: StockOutCommitItem[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function normalizeMatchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function cleanNumber(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function cleanQuantity(value: unknown) {
  const quantity = Math.trunc(cleanNumber(value));
  return quantity > 0 ? quantity : 1;
}

export function normalizeImportedPhone(value: unknown) {
  const raw = String(value ?? "").trim();
  const normalized = normalizeBangladeshPhone(raw);

  // Historical sheets commonly lose the leading zero because Excel treats
  // phone numbers as numeric cells.
  if (/^1\d{9}$/.test(normalized)) {
    return `0${normalized}`;
  }

  return normalized;
}

export function parseHistoricalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = /^(\d{1,2})[\s\-\/]+([A-Za-z]+|\d{1,2})[\s\-\/]+(\d{4})$/.exec(
    raw
  );

  if (!dmy) return null;

  const day = Number(dmy[1]);
  const monthToken = dmy[2].toLowerCase();
  const month = /^\d+$/.test(monthToken)
    ? Number(monthToken)
    : MONTHS[monthToken];
  const year = Number(dmy[3]);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

export function importedDateToUtc(value: string) {
  return bangladeshDateStartUtc(value);
}

export function makeRestoreBatchNo() {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SOR-${stamp}-${suffix}`;
}
