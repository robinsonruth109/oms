import { NextRequest } from "next/server";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderForPdf = {
  invoiceId: string;
  customerName: string;
  phone: string;
  address: string;
  courier: string;
  discount: number;
  advance: number;
  deliveryCharge: number;
  totalAmount: number;
  createdAt: Date;
  pageName: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  note: string;
};

const RETURN_NOTICE_BN =
  "বিঃ দ্রঃ কোন কারনে প্রোডাক্ট ফেরত দিতে ইন্ট্যাক অবস্থায় ব্যাক দিতে হবে, প্যাকেট খোলা যাবে না, যেহেতু এটা ড্রেস না।";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value: string) {
  return String(value || "").trim();
}

function splitItemsForHalfPage(items: OrderForPdf["items"], limit = 5) {
  const rows = [...items];
  while (rows.length < limit) {
    rows.push({
      productName: "",
      quantity: 0,
      unitPrice: 0,
      lineTotal: 0,
    });
  }
  return rows.slice(0, limit);
}

function splitItemsForFullPage(items: OrderForPdf["items"], limit = 12) {
  const rows = [...items];
  while (rows.length < limit) {
    rows.push({
      productName: "",
      quantity: 0,
      unitPrice: 0,
      lineTotal: 0,
    });
  }
  return rows.slice(0, limit);
}

function getInvoiceMode(order: OrderForPdf) {
  return order.items.length > 10 ? "full" : "half";
}

function buildInvoiceHtml(orders: OrderForPdf[]) {
  const invoiceBlocks = orders.map((order) => {
    const mode = getInvoiceMode(order);
    const rows =
      mode === "full"
        ? splitItemsForFullPage(order.items, 12)
        : splitItemsForHalfPage(order.items, 5);

    const rowsHtml = rows
      .map(
        (item) => `
          <tr>
            <td class="product-cell">${escapeHtml(item.productName)}</td>
            <td class="num-cell">${item.unitPrice ? item.unitPrice.toFixed(0) : ""}</td>
            <td class="num-cell">${item.quantity ? String(item.quantity) : ""}</td>
            <td class="num-cell">${item.lineTotal ? item.lineTotal.toFixed(0) : ""}</td>
          </tr>
        `
      )
      .join("");

    return `
      <section class="invoice invoice-${mode}">
        <div class="invoice-inner">
          <div class="header">
            <div class="date-line">
              <span class="label">Date :</span>
              <span class="value">${escapeHtml(formatDate(order.createdAt))}</span>
            </div>

            <div class="shop-block">
              <h1>${escapeHtml(order.pageName || "Invoice")}</h1>
              <div class="shop-subtitle">Mirpur, Dhaka (01303559063)</div>
            </div>

            <div class="phone-line">
              <span class="label">Phone:</span>
              <span class="value">${escapeHtml(order.phone)}</span>
            </div>
          </div>

          <div class="meta">
            <div class="left-meta">
              <div class="meta-row invoice-row">
                <span class="label">Invoice Code :</span>
                <span class="value invoice-value">${escapeHtml(order.invoiceId)}</span>
              </div>

              <div class="meta-row">
                <span class="label">Name:</span>
                <span class="value bangla">${escapeHtml(safeText(order.customerName))}</span>
              </div>

              <div class="meta-row address-row">
                <span class="label address-label">Address:</span>
                <div class="address-box bangla">${escapeHtml(safeText(order.address))}</div>
              </div>
            </div>

            <div class="right-meta">
              <div class="barcode-wrap">
                <svg class="barcode" id="barcode-${escapeHtml(order.invoiceId)}"></svg>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="product-head">Product Name</th>
                <th class="small-head">Price</th>
                <th class="small-head">QTY</th>
                <th class="small-head">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-left">
              <div class="summary-row">
                <span class="label">Delivery Cost=</span>
                <span class="value">${order.deliveryCharge.toFixed(0)}</span>
              </div>
              <div class="summary-row">
                <span class="label">Discount=</span>
                <span class="value">${order.discount.toFixed(0)}</span>
              </div>
              <div class="note-row">
                <span class="label">Note :</span>
                <span class="value bangla">${escapeHtml(RETURN_NOTICE_BN)}</span>
              </div>
            </div>

            <div class="summary-right">
              <div class="summary-row">
                <span class="label">Advance =</span>
                <span class="value">${order.advance.toFixed(0)}</span>
              </div>
              <div class="summary-row grand-total">
                <span class="label">Grand Total=</span>
                <span class="value">${order.totalAmount.toFixed(0)}</span>
              </div>
              <div class="courier-line">${escapeHtml(order.courier || "")}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  });

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Invoice Batch</title>
        <style>
          @font-face {
            font-family: "NotoSansBengali";
            src: url("file://${path
              .join(process.cwd(), "public", "fonts", "NotoSansBengali-Regular.ttf")
              .replace(/\\/g, "/")}") format("truetype");
            font-weight: 400;
            font-style: normal;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: white;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 210mm;
            margin: 0 auto;
          }

          .bangla {
            font-family: "NotoSansBengali", Arial, sans-serif;
            line-height: 1.35;
            word-break: break-word;
            white-space: pre-wrap;
          }

          .invoice {
            width: 190mm;
            margin: 0 auto;
            border-bottom: 1px solid #000;
            page-break-inside: avoid;
          }

          .invoice-half {
            min-height: 135mm;
            padding: 8mm 0 4mm;
          }

          .invoice-full {
            min-height: 270mm;
            padding: 8mm 0 4mm;
            page-break-after: always;
          }

          .invoice-inner {
            width: 100%;
          }

          .header {
            display: grid;
            grid-template-columns: 1fr 1.3fr 1fr;
            align-items: start;
            margin-bottom: 6mm;
          }

          .shop-block {
            text-align: center;
          }

          .shop-block h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }

          .shop-subtitle {
            margin-top: 4px;
            font-size: 11px;
          }

          .date-line,
          .phone-line {
            font-size: 11px;
            font-weight: 700;
            padding-top: 18px;
          }

          .date-line .label,
          .phone-line .label {
            margin-right: 8px;
          }

          .phone-line {
            text-align: right;
          }

          .meta {
            display: grid;
            grid-template-columns: 1fr 140px;
            gap: 12px;
            margin-bottom: 6mm;
          }

          .meta-row {
            display: flex;
            align-items: flex-start;
            margin-bottom: 6px;
            font-size: 12px;
          }

          .meta-row .label {
            width: 110px;
            font-weight: 700;
            flex-shrink: 0;
          }

          .meta-row .value {
            flex: 1;
            min-width: 0;
          }

          .invoice-row .invoice-value {
            font-size: 22px;
            font-weight: 700;
            line-height: 1;
          }

          .address-row {
            align-items: stretch;
          }

          .address-label {
            padding-top: 7px;
          }

          .address-box {
            border: 1px solid #000;
            min-height: 36px;
            padding: 6px 8px;
            width: 100%;
            font-size: 11px;
          }

          .right-meta {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .barcode-wrap {
            width: 100%;
            text-align: center;
            padding-top: 18px;
          }

          .barcode {
            width: 120px;
            height: 36px;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6mm;
            table-layout: fixed;
          }

          .items-table th,
          .items-table td {
            border: 1px solid #000;
            padding: 6px 6px;
            font-size: 11px;
            vertical-align: middle;
          }

          .items-table thead th {
            text-align: center;
            font-weight: 700;
          }

          .product-head {
            width: calc(100% - 180px);
          }

          .small-head {
            width: 60px;
          }

          .product-cell {
            word-break: break-word;
            white-space: pre-wrap;
            font-family: "NotoSansBengali", Arial, sans-serif;
          }

          .num-cell {
            text-align: center;
          }

          .summary {
            display: grid;
            grid-template-columns: 1fr 180px;
            gap: 18px;
            align-items: start;
          }

          .summary-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            font-size: 12px;
          }

          .summary-row .label {
            font-weight: 700;
            min-width: 100px;
          }

          .note-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-top: 10px;
            font-size: 11px;
          }

          .note-row .label {
            font-weight: 700;
            min-width: 48px;
            padding-top: 2px;
          }

          .note-row .value {
            flex: 1;
          }

          .grand-total {
            font-size: 13px;
            font-weight: 700;
          }

          .courier-line {
            margin-top: 18px;
            text-align: right;
            font-size: 11px;
            font-weight: 700;
            word-break: break-word;
          }

          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${invoiceBlocks.join("")}

        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script>
          (() => {
            const values = ${JSON.stringify(orders.map((o) => o.invoiceId || ""))};
            for (const value of values) {
              const el = document.getElementById("barcode-" + value);
              if (!el || !value || typeof JsBarcode === "undefined") continue;
              JsBarcode(el, value, {
                format: "CODE128",
                displayValue: false,
                margin: 0,
                height: 36,
                width: 1.2
              });
            }
          })();
        </script>
      </body>
    </html>
  `;
}

function resolveChromeExecutablePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;

  const batch = await prisma.invoiceBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      items: {
        include: {
          order: {
            include: {
              page: true,
              items: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return new Response("Invoice batch not found", { status: 404 });
  }

  const orders: OrderForPdf[] = batch.items.map((item) => ({
    invoiceId: item.order.invoiceId || "",
    customerName: item.order.customerName || "",
    phone: item.order.phone || "",
    address: item.order.address || "",
    courier: item.order.courier || "",
    discount: Number(item.order.discount),
    advance: Number(item.order.advance),
    deliveryCharge: Number(item.order.deliveryCharge),
    totalAmount: Number(item.order.totalAmount),
    createdAt: item.order.createdAt,
    pageName: item.order.page?.name || "Invoice",
    note: item.order.note || "",
    items: item.order.items.map((orderItem) => ({
      productName: orderItem.productName || "",
      quantity: orderItem.quantity,
      unitPrice: Number(orderItem.unitPrice),
      lineTotal: Number(orderItem.lineTotal),
    })),
  }));

  const html = buildInvoiceHtml(orders);
  const executablePath = resolveChromeExecutablePath();

  if (!executablePath) {
    return new Response(
      "PDF generation failed: Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH.",
      { status: 500 }
    );
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        headless: true,
        timeout: 60000,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--no-first-run",
        ],
      });

      const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1.5,
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await page.emulateMediaType("screen");

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${batch.batchNo}.pdf"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown PDF generation error";

    return new Response(`PDF generation failed: ${message}`, {
      status: 500,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}