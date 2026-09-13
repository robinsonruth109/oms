import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/shop-settings-crypto";
import { convertBanglaDigitsToEnglish, normalizeBangladeshPhone } from "@/lib/phone-normalization";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";

export const STAFF_ROLES = ["AGENT", "NOTE_AGENT", "PACKAGING_AGENT"] as const;

export function normalizeNid(value: string) {
  return convertBanglaDigitsToEnglish(String(value || "")).replace(/\D/g, "");
}

export function isValidNid(value: string) {
  const nid = normalizeNid(value);
  return nid.length === 10 || nid.length === 13 || nid.length === 17;
}

export function hashNid(value: string) {
  return createHash("sha256").update(normalizeNid(value), "utf8").digest("hex");
}

export function encryptNid(value: string) {
  const normalized = normalizeNid(value);
  const encrypted = encryptSecret(normalized);
  return {
    nidEncrypted: encrypted.encrypted,
    nidIv: encrypted.iv,
    nidTag: encrypted.tag,
    nidHash: hashNid(normalized),
    nidLast4: normalized.slice(-4),
  };
}

export function decryptNid(row: {
  nidEncrypted: string;
  nidIv: string;
  nidTag: string;
}) {
  return decryptSecret({
    encrypted: row.nidEncrypted,
    iv: row.nidIv,
    tag: row.nidTag,
  });
}

export function normalizeStaffPhone(value: string) {
  return normalizeBangladeshPhone(value);
}

export function addDaysToBusinessDate(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid date");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonthsToBusinessDate(value: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid date");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function businessDate(value: string) {
  return bangladeshBusinessDateToUtc(value);
}

export function roleLabel(role: string) {
  if (role === "NOTE_AGENT") return "Note Agent";
  if (role === "PACKAGING_AGENT") return "Packaging Agent";
  return "Agent";
}

export function defaultDesignation(role: string) {
  if (role === "NOTE_AGENT") return "Note Agent";
  if (role === "PACKAGING_AGENT") return "Packaging Agent";
  return "Calling Agent";
}
