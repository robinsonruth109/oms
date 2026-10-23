import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";

import { authOptions } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CsvRow = Record<string, string>;

function normalizeKey(value: string) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedRow(row: CsvRow) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[normalizeKey(key)] = String(value ?? "").trim();
  }
  return out;
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function money(value: string) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "")
    .trim();
  const number = Number(normalized || 0);
  return Number.isFinite(number) ? number : 0;
}

function parsePathaoDate(value: string) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (match) {
    const [, month, day, year, hour = "0", minute = "0", second = "0"] = match;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) - 6,
        Number(minute),
        Number(second)
      )
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  const { prisma } = await import("@/lib/prisma");
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const courierId = String(formData.get("courierId") || "").trim();

  if (!courierId) {
    return NextResponse.json(
      { error: "Select the Pathao courier/account for this payment sheet." },
      { status: 400 }
    );
  }

  const courier = await prisma.courier.findFirst({
    where: {
      id: courierId,
      status: true,
      pathaoEnabled: true,
    },
    select: { id: true, name: true },
  });

  if (!courier) {
    return NextResponse.json(
      { error: "Selected Pathao courier/account is unavailable or API is disabled." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a Pathao payment CSV file." }, { status: 400 });
  }

  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Payment sheet is too large. Maximum 12 MB." }, { status: 400 });
  }

  const name = file.name || "pathao-payment.csv";
  if (!/\.(csv|txt)$/i.test(name)) {
    return NextResponse.json(
      { error: "Please upload the Pathao CSV export. Excel can open the same CSV normally." },
      { status: 400 }
    );
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => String(header || "").replace(/^\uFEFF/, "").trim(),
  });

  if (parsed.errors.length && !parsed.data.length) {
    return NextResponse.json(
      { error: parsed.errors[0]?.message || "Unable to read Pathao payment sheet." },
      { status: 400 }
    );
  }

  const rows = parsed.data
    .map(normalizedRow)
    .map((row) => {
      const consignmentId = pick(
        row,
        "Order consignment id",
        "Consignment id",
        "Consignment"
      );
      const merchantOrderId = pick(
        row,
        "Merchant order id",
        "Merchant order"
      ).replace(/^["']|["']$/g, "");

      return {
        row,
        consignmentId,
        merchantOrderId,
        orderCreatedAt: parsePathaoDate(pick(row, "Order created at")),
        paymentStatus: pick(row, "Payment Status", "Payment St"),
        collectibleAmount: money(pick(row, "Collectable Amount", "Collectable", "Collectible Amount")),
        collectedAmount: money(pick(row, "Collected amount")),
        totalFee: money(pick(row, "Total fee")),
        codFee: money(pick(row, "Cod fee", "COD fee")),
        deliveryFee: money(pick(row, "Delivery fee")),
        orderStatus: pick(row, "Order status"),
        storeName: pick(row, "Store name"),
        orderType: pick(row, "Order type"),
        itemType: pick(row, "Item_type", "Item type"),
      };
    })
    .filter((row) => row.consignmentId);

  if (!rows.length) {
    return NextResponse.json(
      { error: 'No "Order consignment id" values were found in this file.' },
      { status: 400 }
    );
  }

  const consignmentIds = Array.from(new Set(rows.map((row) => row.consignmentId)));
  const existing = await prisma.pathaoSettlement.findMany({
    where: { consignmentId: { in: consignmentIds } },
    select: { consignmentId: true },
  });
  const existingIds = new Set(existing.map((row) => row.consignmentId));

  const { getPathaoOrderInfo } = await import("@/lib/pathao/client");

  type ResolvedRow = (typeof rows)[number] & {
    apiMerchantOrderId: string;
    orderId: string | null;
    apiError: string | null;
    pathaoInfo: unknown;
  };

  const resolvedRows: ResolvedRow[] = [];
  const batchSize = 8;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item): Promise<ResolvedRow> => {
        try {
          const info = await getPathaoOrderInfo(courier.id, item.consignmentId);
          const apiMerchantOrderId = String(
            info.merchant_order_id || info.invoice_id || ""
          )
            .trim()
            .replace(/^["']|["']$/g, "");

          if (!apiMerchantOrderId) {
            return {
              ...item,
              apiMerchantOrderId: "",
              orderId: null,
              apiError: "Pathao returned no merchant_order_id/invoice_id.",
              pathaoInfo: info,
            };
          }

          const order = await prisma.order.findFirst({
            where: {
              OR: [
                { invoiceId: apiMerchantOrderId },
                { pathaoMerchantOrderId: apiMerchantOrderId },
              ],
            },
            select: { id: true },
          });

          return {
            ...item,
            apiMerchantOrderId,
            orderId: order?.id || null,
            apiError: order
              ? null
              : `OMS order not found for Pathao merchant order ID ${apiMerchantOrderId}.`,
            pathaoInfo: info,
          };
        } catch (error) {
          return {
            ...item,
            apiMerchantOrderId: "",
            orderId: null,
            apiError:
              error instanceof Error
                ? error.message
                : "Pathao order lookup failed.",
            pathaoInfo: null,
          };
        }
      })
    );

    resolvedRows.push(...batchResults);
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  let duplicateCount = 0;
  let apiErrorCount = 0;

  const upload = await prisma.pathaoSettlementUpload.create({
    data: {
      fileName: name,
      rowCount: rows.length,
      matchedCount: 0,
      unmatchedCount: 0,
      duplicateCount: 0,
      uploadedByUserId: session.user.id || null,
    },
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of resolvedRows) {
        if (item.orderId) matchedCount += 1;
        else unmatchedCount += 1;
        if (item.apiError) apiErrorCount += 1;
        if (existingIds.has(item.consignmentId)) duplicateCount += 1;

        const data = {
          orderId: item.orderId,
          merchantOrderId: item.apiMerchantOrderId || item.merchantOrderId || null,
          paymentStatus: item.paymentStatus || null,
          orderStatus: item.orderStatus || null,
          storeName: item.storeName || null,
          orderType: item.orderType || null,
          itemType: item.itemType || null,
          collectibleAmount: item.collectibleAmount,
          collectedAmount: item.collectedAmount,
          deliveryFee: item.deliveryFee,
          codFee: item.codFee,
          totalFee: item.totalFee,
          orderCreatedAt: item.orderCreatedAt,
          rawRow: {
            paymentSheet: item.row,
            pathaoOrderInfo: item.pathaoInfo,
            selectedCourierId: courier.id,
            selectedCourierName: courier.name,
            resolutionError: item.apiError,
          },
          uploadId: upload.id,
        };

        await tx.pathaoSettlement.upsert({
          where: { consignmentId: item.consignmentId },
          create: {
            consignmentId: item.consignmentId,
            ...data,
          },
          update: data,
        });
      }

      await tx.pathaoSettlementUpload.update({
        where: { id: upload.id },
        data: {
          matchedCount,
          unmatchedCount,
          duplicateCount,
        },
      });
    });
  } catch (error) {
    await prisma.pathaoSettlementUpload.delete({ where: { id: upload.id } }).catch(() => undefined);
    throw error;
  }

  return NextResponse.json({
    ok: true,
    uploadId: upload.id,
    fileName: name,
    rowCount: rows.length,
    matchedCount,
    unmatchedCount,
    duplicateCount,
    apiErrorCount,
    courier: {
      id: courier.id,
      name: courier.name,
    },
    totals: {
      collectedAmount: rows.reduce((sum, row) => sum + row.collectedAmount, 0),
      deliveryFee: rows.reduce((sum, row) => sum + row.deliveryFee, 0),
      codFee: rows.reduce((sum, row) => sum + row.codFee, 0),
      totalFee: rows.reduce((sum, row) => sum + row.totalFee, 0),
    },
  });
}
