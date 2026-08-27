import { createSign } from "node:crypto";

export type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function parseServiceAccountJson(value: string): GoogleServiceAccount {
  const parsed = JSON.parse(value) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service Account JSON must contain client_email and private_key.");
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
    project_id: parsed.project_id,
  };
}

async function getAccessToken(account: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: account.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(account.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "Google OAuth token request failed.");
  }
  return body.access_token;
}

async function googleRequest<T>(
  account: GoogleServiceAccount,
  url: string,
  init?: RequestInit
): Promise<T> {
  const token = await getAccessToken(account);
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : String(body || response.statusText);
    throw new Error(`Google Sheets API ${response.status}: ${message}`);
  }
  return body as T;
}

export const READY_ORDER_SHEET_HEADERS = [
  "OMS Order UUID",
  "Ready To Ship Date",
  "Invoice ID",
  "Order ID",
  "Customer Name",
  "Phone",
  "Address",
  "Source",
  "Page",
  "Courier",
  "Items",
  "Subtotal",
  "Delivery Charge",
  "Discount",
  "Advance",
  "Final Total",
  "Consignment ID",
  "Pathao Status",
  "Called By",
  "Called At",
  "Imported At",
  "Synced At",
];

export async function testGoogleSheetConnection(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
}) {
  const { account, spreadsheetId, sheetName } = input;
  const metadata = await googleRequest<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`
  );
  const exists = metadata.sheets?.some((sheet) => sheet.properties?.title === sheetName);
  if (!exists) throw new Error(`Sheet tab “${sheetName}” was not found.`);
  return true;
}

export async function ensureReadyOrderSheetHeader(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
}) {
  const { account, spreadsheetId, sheetName } = input;
  const range = `'${sheetName.replace(/'/g, "''")}'!A1:V1`;
  await googleRequest(account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values: [READY_ORDER_SHEET_HEADERS] }),
    }
  );
}

export async function appendReadyOrderRows(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
  rows: Array<Array<string | number>>;
}) {
  const { account, spreadsheetId, sheetName, rows } = input;
  if (!rows.length) return { startRow: null as number | null, updatedRows: 0 };
  const range = `'${sheetName.replace(/'/g, "''")}'!A:V`;
  const result = await googleRequest<{ updates?: { updatedRange?: string; updatedRows?: number } }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values: rows }),
    }
  );
  const updatedRange = result.updates?.updatedRange || "";
  const match = updatedRange.match(/![A-Z]+(\d+):[A-Z]+\d+$/i);
  return {
    startRow: match ? Number(match[1]) : null,
    updatedRows: Number(result.updates?.updatedRows || rows.length),
  };
}
