import { decryptSecret, encryptSecret } from "@/lib/shop-settings-crypto";
import { parseServiceAccountJson, type GoogleServiceAccount } from "./client";

export const DEFAULT_READY_ORDER_SPREADSHEET_ID = "1KKjrdOzeLlG0YY_6OFrmT1ow-E1udc_kkB3ZEqrjMFs";
export const DEFAULT_READY_ORDER_SHEET_NAME = "Data";

export function encryptGoogleServiceAccount(json: string) {
  const account = parseServiceAccountJson(json);
  const encrypted = encryptSecret(JSON.stringify(account));
  return { ...encrypted, email: account.client_email };
}

export function decryptGoogleServiceAccount(row: {
  serviceAccountEncrypted: string | null;
  serviceAccountIv: string | null;
  serviceAccountTag: string | null;
}): GoogleServiceAccount {
  if (!row.serviceAccountEncrypted || !row.serviceAccountIv || !row.serviceAccountTag) {
    throw new Error("Google Service Account credentials are not configured.");
  }
  const text = decryptSecret({
    encrypted: row.serviceAccountEncrypted,
    iv: row.serviceAccountIv,
    tag: row.serviceAccountTag,
  });
  return parseServiceAccountJson(text);
}
