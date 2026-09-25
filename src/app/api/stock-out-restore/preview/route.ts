import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { parse } from "csv-parse/sync";
import { authOptions } from "@/lib/auth";
import {
  cleanNumber,
  cleanQuantity,
  normalizeImportedPhone,
  normalizeMatchText,
  parseHistoricalDate,
  type StockOutPreviewItem,
  type StockOutPreviewRow,
} from "@/lib/stock-out-restore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CsvRecord = Record<string, string>;

function field(record: CsvRecord, ...names: string[]) {
  for (const name of names) {
    if (record[name] !== undefined) {
      return String(record[name] ?? "").trim();
    }
  }
  return "";
}

function collectItems(record: CsvRecord) {
  const headers = Object.keys(record);
  const positions = new Set<number>();

  for (const header of headers) {
    const match = /^Product SKU\s*(\d+)$/i.exec(header.trim());
    if (match) positions.add(Number(match[1]));
  }

  if (!positions.size && field(record, "Product SKU 1")) positions.add(1);

  return [...positions]
    .sort((a, b) => a - b)
    .map((position) => {
      const csvSku = field(
        record,
        `Product SKU ${position}`,
        `Product SKU${position}`
      );
      const csvParentCode =
        position === 1
          ? field(record, "Product Parent Code")
          : field(
              record,
              `Product Parent Code ${position}`,
              `Product Parent Code${position}`
            );

      const unitPrice = cleanNumber(
        field(
          record,
          `Product Price${position}`,
          `Product Price ${position}`
        )
      );

      const quantity = cleanQuantity(
        field(record, `QTY${position}`, `QTY ${position}`)
      );

      return {
        position,
        csvSku,
        csvParentCode,
        unitPrice,
        quantity,
      };
    })
    .filter((item) => item.csvSku || item.csvParentCode);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Please upload a CSV file." },
        { status: 400 }
      );
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRecord[];

    if (!records.length) {
      return NextResponse.json(
        { success: false, message: "CSV has no order rows." },
        { status: 400 }
      );
    }

    const invoiceIds = records
      .map((record) => field(record, "Invoice ID", "Invoice", "invoiceId"))
      .filter(Boolean);

    const { prisma } = await import("@/lib/prisma");

    const [pages, products, couriers, existingOrders] = await Promise.all([
      prisma.page.findMany({
        where: { status: true },
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { status: true },
        include: {
          parent: {
            select: { sku: true, name: true },
          },
        },
      }),
      prisma.courier.findMany({
        where: { status: true },
        select: { slug: true, name: true },
      }),
      prisma.order.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: {
          id: true,
          invoiceId: true,
          orderStatus: true,
          sourceId: true,
          pageId: true,
          courier: true,
        },
      }),
    ]);

    const pageByName = new Map(
      pages.map((page) => [normalizeMatchText(page.name), page])
    );

    const productByExactSku = new Map(
      products.map((product) => [product.sku, product])
    );
    const productByNormalizedSku = new Map(
      products.map((product) => [normalizeMatchText(product.sku), product])
    );

    const productsByParent = new Map<string, typeof products>();
    for (const product of products) {
      const key = normalizeMatchText(product.parent.sku);
      const list = productsByParent.get(key) || [];
      list.push(product);
      productsByParent.set(key, list);
    }

    const courierSlugSet = new Set(couriers.map((courier) => courier.slug));
    const existingByInvoice = new Map(
      existingOrders
        .filter((order) => order.invoiceId)
        .map((order) => [String(order.invoiceId), order])
    );

    const matchedPageIds = [
      ...new Set(
        records
          .map((record) => pageByName.get(normalizeMatchText(field(record, "Page Name")))?.id)
          .filter((value): value is string => Boolean(value))
      ),
    ];

    const recentPageDefaults = await Promise.all(
      matchedPageIds.map(async (pageId) => {
        const recent = await prisma.order.findFirst({
          where: { pageId },
          orderBy: { createdAt: "desc" },
          select: { sourceId: true, courier: true },
        });

        return {
          pageId,
          sourceId: recent?.sourceId || null,
          courier:
            recent?.courier && courierSlugSet.has(recent.courier)
              ? recent.courier
              : null,
        };
      })
    );

    const defaultsByPageId = new Map(
      recentPageDefaults.map((row) => [row.pageId, row])
    );

    const previewRows: StockOutPreviewRow[] = records.map((record, index) => {
      const rowNumber = index + 2;
      const invoiceId = field(record, "Invoice ID", "Invoice", "invoiceId");
      const pageName = field(record, "Page Name");
      const page = pageByName.get(normalizeMatchText(pageName)) || null;
      const existing = existingByInvoice.get(invoiceId) || null;
      const pageDefaults = page ? defaultsByPageId.get(page.id) : null;

      const importedDate = parseHistoricalDate(field(record, "Date")) || "";
      const customerName = field(record, "Customer Name", "Customer");
      const phone = normalizeImportedPhone(field(record, "Phone", "Phone Number"));
      const address = field(record, "Address");
      const deliveryCharge = cleanNumber(
        field(record, "DV Cost", "Delivery Charge", "Delivery")
      );
      const discount = cleanNumber(field(record, "Discount"));
      const grandTotal = cleanNumber(
        field(record, "Grand Total", "Total Amount", "Total")
      );

      const items: StockOutPreviewItem[] = collectItems(record).map((item) => {
        let product =
          (item.csvSku ? productByExactSku.get(item.csvSku) : null) || null;
        let matchedBy: StockOutPreviewItem["matchedBy"] = product
          ? "EXACT_SKU"
          : "NONE";

        if (!product && item.csvSku) {
          product =
            productByNormalizedSku.get(normalizeMatchText(item.csvSku)) || null;
          if (product) matchedBy = "NORMALIZED_SKU";
        }

        if (!product && item.csvParentCode) {
          const parentMatches =
            productsByParent.get(normalizeMatchText(item.csvParentCode)) || [];

          if (parentMatches.length === 1) {
            product = parentMatches[0];
            matchedBy = "PARENT_CODE";
          }
        }

        return {
          position: item.position,
          csvSku: item.csvSku,
          csvParentCode: item.csvParentCode,
          name: product?.name || item.csvSku || item.csvParentCode || "Product",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          suggestedProductId: product?.id || null,
          suggestedProductSku: product?.sku || null,
          suggestedProductName: product?.name || null,
          matchedBy,
        };
      });

      let action: StockOutPreviewRow["action"] = "CREATE";
      let message = "New historical order will be created directly in Ready to Ship.";

      if (!invoiceId) {
        action = "BLOCKED";
        message = "Invoice ID is missing.";
      } else if (existing?.orderStatus === "STOCK_OUT") {
        action = "RESTORE";
        message =
          "Existing STOCK_OUT invoice found. OMS will update the reviewed data and restore this existing order to Ready to Ship.";
      } else if (existing) {
        action = "BLOCKED";
        message = `Invoice already exists in OMS with status ${existing.orderStatus}. It will not be duplicated.`;
      }

      if (!importedDate && action !== "BLOCKED") {
        message += " CSV date could not be parsed; select/fix the date before commit.";
      }

      return {
        rowNumber,
        invoiceId,
        pageName,
        importedDate,
        customerName,
        phone,
        address,
        deliveryCharge,
        discount,
        grandTotal,
        items,
        suggestedPageId: existing?.pageId || page?.id || null,
        suggestedSourceId:
          existing?.sourceId || pageDefaults?.sourceId || null,
        suggestedCourierSlug:
          (existing?.courier && courierSlugSet.has(existing.courier)
            ? existing.courier
            : null) ||
          pageDefaults?.courier ||
          null,
        existingOrderId: existing?.id || null,
        existingOrderStatus: existing?.orderStatus || null,
        existingOrderCourier: existing?.courier || null,
        action,
        message,
      };
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      rows: previewRows,
      summary: {
        total: previewRows.length,
        newOrders: previewRows.filter((row) => row.action === "CREATE").length,
        restoreOrders: previewRows.filter((row) => row.action === "RESTORE").length,
        blocked: previewRows.filter((row) => row.action === "BLOCKED").length,
      },
    });
  } catch (error) {
    console.error("Stock Out restore CSV preview failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to parse Stock Out CSV.",
      },
      { status: 500 }
    );
  }
}
