import {
  duplicateReadyOrderSheet,
  readReadyOrderSheetRows,
  replaceReadyOrderSheetRows,
  READY_ORDER_SHEET_HEADERS,
} from "./client";
import { decryptGoogleServiceAccount } from "./settings";
import {
  buildReadyOrderSheetRow,
  MAX_READY_ORDER_PRODUCT_COLUMNS,
  type ReadyOrderSheetOrder,
} from "./ready-order-row";

const LOOKUP_CHUNK_SIZE = 500;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isBlankRow(row: unknown[]) {
  return !row.some((value) => text(value) !== "");
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function backupTitle(sheetName: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const suffix = `${values.year}-${values.month}-${values.day} ${values.hour}-${values.minute}-${values.second}`;
  return `${sheetName} Backup ${suffix}`.slice(0, 95);
}

function dateFromExistingRow(header: unknown[], row: unknown[]) {
  const dateIndex = header.findIndex((value) => {
    const normalized = normalizeHeader(value);
    return normalized === "date" || normalized === "ready to ship date";
  });
  if (dateIndex < 0) return null;
  const value = text(row[dateIndex]);
  const ddmmyyyy = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(value);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (yyyymmdd) return value;
  return null;
}

type SourceEntry = {
  sheetRowNumber: number;
  blank: boolean;
  uuid: string | null;
  invoiceId: string | null;
  existingBusinessDate: string | null;
};

type PreparedUpgrade = {
  account: ReturnType<typeof decryptGoogleServiceAccount>;
  spreadsheetId: string;
  sheetName: string;
  sourceRows: unknown[][];
  entries: SourceEntry[];
  convertedRows: Array<Array<string | number>>;
  matchedRows: number;
  unmatchedRows: SourceEntry[];
  tooManyProductRows: Array<{ sheetRowNumber: number; invoiceId: string }>;
  alreadyNewHeader: boolean;
};

async function prepareUpgrade(): Promise<PreparedUpgrade> {
  const { prisma } = await import("@/lib/prisma");
  const setting = await prisma.readyOrderSheetSetting.findUnique({ where: { id: "default" } });
  if (!setting?.spreadsheetId) {
    throw new Error("Google Sheet Spreadsheet ID is not configured.");
  }

  const account = decryptGoogleServiceAccount(setting);
  const spreadsheetId = setting.spreadsheetId;
  const sheetName = setting.sheetName || "Data";
  const sourceRows = await readReadyOrderSheetRows({ account, spreadsheetId, sheetName });

  if (!sourceRows.length) {
    throw new Error("The configured Google Sheet is empty.");
  }

  const header = sourceRows[0] || [];
  const alreadyNewHeader = READY_ORDER_SHEET_HEADERS.every(
    (expected, index) => text(header[index]) === expected
  );

  let lastDataIndex = sourceRows.length - 1;
  while (lastDataIndex > 0 && isBlankRow(sourceRows[lastDataIndex] || [])) {
    lastDataIndex -= 1;
  }

  const dataRows = sourceRows.slice(1, lastDataIndex + 1);
  if (!dataRows.length) {
    throw new Error("The configured Google Sheet has a header but no data rows.");
  }

  const uuidIndex = header.findIndex((value) => {
    const normalized = normalizeHeader(value);
    return normalized === "uuid" || normalized === "oms order uuid";
  });
  const invoiceIndexes = header
    .map((value, index) => ({ value: normalizeHeader(value), index }))
    .filter((item) => item.value === "invoice id")
    .map((item) => item.index);

  // Support the original 22-column OMS sheet even if its header was edited.
  const invoiceFallbackIndexes = Array.from(new Set([...invoiceIndexes, 2, 1]));

  const entries: SourceEntry[] = dataRows.map((row, index) => {
    if (isBlankRow(row)) {
      return {
        sheetRowNumber: index + 2,
        blank: true,
        uuid: null,
        invoiceId: null,
        existingBusinessDate: null,
      };
    }

    const uuidCandidate = uuidIndex >= 0 ? text(row[uuidIndex]) : text(row[0]);
    const uuid = isUuid(uuidCandidate) ? uuidCandidate : null;
    let invoiceId: string | null = null;
    for (const candidateIndex of invoiceFallbackIndexes) {
      const candidate = text(row[candidateIndex]);
      if (candidate) {
        invoiceId = candidate;
        break;
      }
    }

    return {
      sheetRowNumber: index + 2,
      blank: false,
      uuid,
      invoiceId,
      existingBusinessDate: dateFromExistingRow(header, row),
    };
  });

  const uuids = Array.from(
    new Set(entries.map((entry) => entry.uuid).filter((value): value is string => Boolean(value)))
  );
  const invoiceIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.invoiceId)
        .filter((value): value is string => Boolean(value))
    )
  );

  const orderById = new Map<string, ReadyOrderSheetOrder>();
  const orderByInvoice = new Map<string, ReadyOrderSheetOrder>();

  const include = {
    source: { select: { name: true } },
    items: {
      select: {
        productSku: true,
        quantity: true,
        unitPrice: true,
        product: {
          select: {
            parent: {
              select: { sku: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
  };

  for (const values of chunk(uuids, LOOKUP_CHUNK_SIZE)) {
    const orders = await prisma.order.findMany({
      where: { id: { in: values } },
      include,
    });
    for (const order of orders) {
      orderById.set(order.id, order as ReadyOrderSheetOrder);
      if (order.invoiceId) orderByInvoice.set(order.invoiceId, order as ReadyOrderSheetOrder);
    }
  }

  for (const values of chunk(invoiceIds, LOOKUP_CHUNK_SIZE)) {
    const missingInvoices = values.filter((invoiceId) => !orderByInvoice.has(invoiceId));
    if (!missingInvoices.length) continue;
    const orders = await prisma.order.findMany({
      where: { invoiceId: { in: missingInvoices } },
      include,
    });
    for (const order of orders) {
      orderById.set(order.id, order as ReadyOrderSheetOrder);
      if (order.invoiceId) orderByInvoice.set(order.invoiceId, order as ReadyOrderSheetOrder);
    }
  }

  const matchedOrderIds = Array.from(
    new Set(
      entries
        .filter((entry) => !entry.blank)
        .map((entry) => {
          const order =
            (entry.uuid ? orderById.get(entry.uuid) : undefined) ||
            (entry.invoiceId ? orderByInvoice.get(entry.invoiceId) : undefined);
          return order?.id || null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const syncDateByOrderId = new Map<string, string>();
  for (const values of chunk(matchedOrderIds, LOOKUP_CHUNK_SIZE)) {
    const syncItems = await prisma.readyOrderSheetSyncItem.findMany({
      where: {
        spreadsheetId,
        sheetName,
        orderId: { in: values },
      },
      select: { orderId: true, businessDate: true },
    });
    for (const item of syncItems) syncDateByOrderId.set(item.orderId, item.businessDate);
  }

  const unmatchedRows: SourceEntry[] = [];
  const tooManyProductRows: Array<{ sheetRowNumber: number; invoiceId: string }> = [];
  const convertedRows: Array<Array<string | number>> = [];
  let matchedRows = 0;

  for (const entry of entries) {
    if (entry.blank) {
      convertedRows.push(Array.from({ length: READY_ORDER_SHEET_HEADERS.length }, () => ""));
      continue;
    }

    const order =
      (entry.uuid ? orderById.get(entry.uuid) : undefined) ||
      (entry.invoiceId ? orderByInvoice.get(entry.invoiceId) : undefined);

    if (!order) {
      unmatchedRows.push(entry);
      convertedRows.push(Array.from({ length: READY_ORDER_SHEET_HEADERS.length }, () => ""));
      continue;
    }

    if (order.items.length > MAX_READY_ORDER_PRODUCT_COLUMNS) {
      tooManyProductRows.push({
        sheetRowNumber: entry.sheetRowNumber,
        invoiceId: order.invoiceId || entry.invoiceId || order.id,
      });
    }

    const businessDate =
      syncDateByOrderId.get(order.id) || entry.existingBusinessDate || null;

    convertedRows.push(
      buildReadyOrderSheetRow(order, {
        businessDate,
        // Every row in this storage sheet represents the moment the order
        // entered READY_TO_SHIP, even if the live OMS status changed later.
        statusOverride: "Ready",
      })
    );
    matchedRows += 1;
  }

  return {
    account,
    spreadsheetId,
    sheetName,
    sourceRows,
    entries,
    convertedRows,
    matchedRows,
    unmatchedRows,
    tooManyProductRows,
    alreadyNewHeader,
  };
}

export async function inspectExistingReadyOrderSheetUpgrade() {
  const prepared = await prepareUpgrade();
  const blankRows = prepared.entries.filter((entry) => entry.blank).length;
  return {
    totalRows: prepared.entries.length,
    dataRows: prepared.entries.length - blankRows,
    blankRows,
    matchedRows: prepared.matchedRows,
    unmatchedRows: prepared.unmatchedRows.length,
    tooManyProductRows: prepared.tooManyProductRows.length,
    alreadyNewHeader: prepared.alreadyNewHeader,
    unmatchedSamples: prepared.unmatchedRows.slice(0, 8).map((entry) => ({
      row: entry.sheetRowNumber,
      invoiceId: entry.invoiceId || "(blank)",
      uuid: entry.uuid || "(blank)",
    })),
    tooManyProductSamples: prepared.tooManyProductRows.slice(0, 8),
  };
}

export async function upgradeExistingReadyOrderSheet() {
  const prepared = await prepareUpgrade();

  if (prepared.unmatchedRows.length) {
    const samples = prepared.unmatchedRows
      .slice(0, 5)
      .map((entry) => `row ${entry.sheetRowNumber}: ${entry.invoiceId || entry.uuid || "no ID"}`)
      .join(", ");
    throw new Error(
      `Upgrade stopped before changing the Sheet: ${prepared.unmatchedRows.length} existing row(s) could not be matched to OMS orders. ` +
        `Examples: ${samples}. No Sheet data was changed.`
    );
  }

  if (prepared.tooManyProductRows.length) {
    const samples = prepared.tooManyProductRows
      .slice(0, 5)
      .map((entry) => `row ${entry.sheetRowNumber}: ${entry.invoiceId}`)
      .join(", ");
    throw new Error(
      `Upgrade stopped before changing the Sheet: ${prepared.tooManyProductRows.length} row(s) contain more than ${MAX_READY_ORDER_PRODUCT_COLUMNS} product lines. ` +
        `Examples: ${samples}. No Sheet data was changed.`
    );
  }

  const backupSheetName = backupTitle(prepared.sheetName);
  const createdBackup = await duplicateReadyOrderSheet({
    account: prepared.account,
    spreadsheetId: prepared.spreadsheetId,
    sheetName: prepared.sheetName,
    backupSheetName,
  });

  try {
    await replaceReadyOrderSheetRows({
      account: prepared.account,
      spreadsheetId: prepared.spreadsheetId,
      sheetName: prepared.sheetName,
      rows: prepared.convertedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Sheets error.";
    throw new Error(
      `A backup named “${createdBackup}” was created, but the rewrite did not finish: ${message}`
    );
  }

  return {
    updatedRows: prepared.matchedRows,
    totalRows: prepared.entries.length,
    backupSheetName: createdBackup,
  };
}
