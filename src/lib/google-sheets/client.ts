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
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : String(body || response.statusText);
    throw new Error(`Google Sheets API ${response.status}: ${message}`);
  }
  return body as T;
}

/**
 * Required Ready Order sheet layout.
 *
 * A      UUID
 * B-C    Invoice ID (intentionally duplicated)
 * D-H    Source/date/customer/phone/address
 * I-AN   8 product groups × 4 columns
 * AO-AT  totals/note/status
 */
export const READY_ORDER_SHEET_HEADERS = [
  "UUID",
  "Invoice ID",
  "Invoice ID",
  "Source Name",
  "Date",
  "Customer Name",
  "Phone Number",
  "Address",
  "Product Parent Code-1",
  "Product SKU-1",
  "Product Price-1",
  "QTY-1",
  "Product Parent Code-2",
  "Product SKU-2",
  "Product Price-2",
  "QTY-2",
  "Product Parent Code-3",
  "Product SKU-3",
  "Product Price-3",
  "QTY-3",
  "Product Parent Code-4",
  "Product SKU-4",
  "Product Price-4",
  "QTY-4",
  "Product Parent Code-5",
  "Product SKU-5",
  "Product Price-5",
  "QTY-5",
  "Product Parent Code-6",
  "Product SKU-6",
  "Product Price-6",
  "QTY-6",
  "Product Parent Code-7",
  "Product SKU-7",
  "Product Price-7",
  "QTY-7",
  "Product Parent Code-8",
  "Product SKU-8",
  "Product Price-8",
  "QTY-8",
  "DV Cost",
  "Advance",
  "Discount",
  "Grand Total",
  "Note",
  "Status",
] as const;

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

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
  const range = `${quoteSheetName(sheetName)}!A1:AT1`;

  // Never rewrite an existing sheet header during ordinary daily sync.
  // Historical conversion is handled only by the explicit admin upgrade tool.
  const existing = await googleRequest<{ values?: unknown[][] }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  );

  const firstRow = existing.values?.[0] || [];
  const hasExistingHeader = firstRow.some((value) => String(value ?? "").trim() !== "");
  if (hasExistingHeader) return;

  await googleRequest(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: [READY_ORDER_SHEET_HEADERS],
      }),
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

  const expectedColumns = READY_ORDER_SHEET_HEADERS.length;
  const invalidRow = rows.findIndex((row) => row.length !== expectedColumns);
  if (invalidRow !== -1) {
    throw new Error(
      `Ready Order Sheet row ${invalidRow + 1} has ${rows[invalidRow].length} columns; expected ${expectedColumns}.`
    );
  }

  const range = `${quoteSheetName(sheetName)}!A:AT`;
  const result = await googleRequest<{ updates?: { updatedRange?: string; updatedRows?: number } }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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

export async function readReadyOrderSheetRows(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
}) {
  const { account, spreadsheetId, sheetName } = input;
  const range = `${quoteSheetName(sheetName)}!A:AT`;
  const result = await googleRequest<{ values?: unknown[][] }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  );
  return result.values || [];
}

export async function duplicateReadyOrderSheet(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
  backupSheetName: string;
}) {
  const { account, spreadsheetId, sheetName, backupSheetName } = input;
  const metadata = await googleRequest<{
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.sheetId,sheets.properties.title`
  );

  const source = metadata.sheets?.find((sheet) => sheet.properties?.title === sheetName);
  const sourceSheetId = source?.properties?.sheetId;
  if (typeof sourceSheetId !== "number") {
    throw new Error(`Sheet tab “${sheetName}” was not found.`);
  }

  const duplicate = await googleRequest<{
    replies?: Array<{ duplicateSheet?: { properties?: { sheetId?: number; title?: string } } }>;
  }>(
    account,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            duplicateSheet: {
              sourceSheetId,
              newSheetName: backupSheetName,
            },
          },
        ],
      }),
    }
  );

  const createdTitle = duplicate.replies?.[0]?.duplicateSheet?.properties?.title;
  return createdTitle || backupSheetName;
}

export async function replaceReadyOrderSheetRows(input: {
  account: GoogleServiceAccount;
  spreadsheetId: string;
  sheetName: string;
  rows: Array<Array<string | number>>;
}) {
  const { account, spreadsheetId, sheetName, rows } = input;
  const expectedColumns = READY_ORDER_SHEET_HEADERS.length;
  const invalidRow = rows.findIndex((row) => row.length !== expectedColumns);
  if (invalidRow !== -1) {
    throw new Error(
      `Historical row ${invalidRow + 1} has ${rows[invalidRow].length} columns; expected ${expectedColumns}.`
    );
  }

  // Write the converted rows in-place. The migration keeps the existing row
  // count/order, so there is no destructive clear before the replacement.
  // A full backup tab is created by the migration service before this runs.
  const allRows: Array<Array<string | number>> = [
    [...READY_ORDER_SHEET_HEADERS],
    ...rows,
  ];

  const batchSize = 300;
  for (let offset = 0; offset < allRows.length; offset += batchSize) {
    const chunk = allRows.slice(offset, offset + batchSize);
    const startRow = offset + 1;
    const endRow = startRow + chunk.length - 1;
    const range = `${quoteSheetName(sheetName)}!A${startRow}:AT${endRow}`;

    await googleRequest(
      account,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: chunk,
        }),
      }
    );
  }

  return { updatedRows: rows.length };
}
