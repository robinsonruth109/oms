import { NextRequest } from "next/server";

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

function splitItemsForHalfPage(items: OrderForPdf["items"], limit = 4) {
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

function splitItemsForFullPage(items: OrderForPdf["items"], limit = 10) {
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
  return order.items.length > 4 ? "full" : "half";
}

function buildInvoiceHtml(orders: OrderForPdf[], fontPath: string) {
  const invoiceBlocks = orders
    .map((order) => {
      const invoiceId = safeText(order.invoiceId);
      const mode = getInvoiceMode(order);

      const rows =
        mode === "full"
          ? splitItemsForFullPage(order.items, 10)
          : splitItemsForHalfPage(order.items, 4);

      const rowsHtml = rows
        .map(
          (item, index) => `
            <tr>
              <td class="sl-cell">${item.productName ? index + 1 : ""}</td>
              <td class="product-cell">${escapeHtml(item.productName)}</td>
              <td class="num-cell">${item.unitPrice ? item.unitPrice.toFixed(0) : ""}</td>
              <td class="num-cell">${item.quantity ? String(item.quantity) : ""}</td>
              <td class="num-cell">${item.lineTotal ? item.lineTotal.toFixed(0) : ""}</td>
            </tr>
          `
        )
        .join("");

      const subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0
      );

      return `
        <section class="invoice invoice-${mode}">
          <div class="invoice-inner">
            <div class="top-line"></div>

            <div class="header">
              <div>
                <h1>${escapeHtml(order.pageName || "Invoice")}</h1>
                <div class="shop-info">Mirpur, Dhaka • 01303559063</div>
              </div>

              <div class="invoice-title">
                <div class="title-box">INVOICE</div>
                <div class="date-text">Date: ${escapeHtml(formatDate(order.createdAt))}</div>
              </div>
            </div>

            <div class="customer-grid">
              <div class="customer-info">
                <div class="info-row">
                  <span>Invoice Code</span>
                  <b>${escapeHtml(invoiceId)}</b>
                </div>
                <div class="info-row">
                  <span>Name</span>
                  <b class="bangla">${escapeHtml(safeText(order.customerName))}</b>
                </div>
                <div class="info-row address-line">
                  <span>Address</span>
                  <b class="bangla">${escapeHtml(safeText(order.address))}</b>
                </div>
              </div>

              <div class="barcode-box">
                <div class="barcode-label">INVOICE BARCODE</div>
                <svg class="barcode" data-code="${escapeHtml(invoiceId)}"></svg>
                <div class="barcode-text">${escapeHtml(invoiceId)}</div>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th class="sl-head">SL</th>
                  <th>PRODUCT NAME</th>
                  <th class="small-head">PRICE</th>
                  <th class="qty-head">QTY</th>
                  <th class="small-head">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="bottom-grid">
              <div>
                <div class="mini-summary">
                  <div>
                    <span>Delivery Cost</span>
                    <b>৳ ${order.deliveryCharge.toFixed(0)}</b>
                  </div>
                  <div>
                    <span>Discount</span>
                    <b>৳ ${order.discount.toFixed(0)}</b>
                  </div>
                  <div>
                    <span>Advance</span>
                    <b>৳ ${order.advance.toFixed(0)}</b>
                  </div>
                </div>

                <div class="note-box">
                  <strong>Note:</strong>
                  <span class="bangla">${escapeHtml(order.note || RETURN_NOTICE_BN)}</span>
                </div>
              </div>

              <div class="total-box">
                <div><span>Subtotal</span><b>৳ ${subtotal.toFixed(0)}</b></div>
                <div><span>Delivery Cost</span><b>৳ ${order.deliveryCharge.toFixed(0)}</b></div>
                <div><span>Discount</span><b>- ৳ ${order.discount.toFixed(0)}</b></div>
                <div><span>Advance</span><b>- ৳ ${order.advance.toFixed(0)}</b></div>
                <div class="grand"><span>Grand Total</span><b>৳ ${order.totalAmount.toFixed(0)}</b></div>
                <p>${escapeHtml(order.courier || "")}</p>
              </div>
            </div>

            <div class="cut-line">✂ -----------------------------------------------------------------------------</div>
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face {
            font-family: "NotoSansBengali";
            src: url("file://${fontPath}") format("truetype");
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
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
            line-height: 1.3;
            word-break: break-word;
          }

          .invoice {
            width: 190mm;
            margin: 0 auto;
            page-break-inside: avoid;
          }

          .invoice-half {
            height: 148mm;
            padding: 6mm 0 3mm;
          }

          .invoice-full {
            height: 296mm;
            padding: 7mm 0;
            page-break-after: always;
          }

          .top-line {
            border-top: 2px solid #000;
            margin-bottom: 5mm;
          }

          .header {
            display: grid;
            grid-template-columns: 1fr 45mm;
            align-items: start;
            margin-bottom: 5mm;
          }

          h1 {
            margin: 0;
            font-size: 22px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .shop-info {
            margin-top: 4px;
            font-size: 11px;
          }

          .invoice-title {
            text-align: right;
            font-size: 12px;
          }

          .title-box {
            display: inline-block;
            background: #000;
            color: #fff;
            padding: 5px 18px;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .date-text {
            margin-top: 6px;
            font-weight: 700;
          }

          .customer-grid {
            display: grid;
            grid-template-columns: 1fr 78mm;
            gap: 8mm;
            margin-bottom: 4mm;
            align-items: center;
          }

          .info-row {
            display: grid;
            grid-template-columns: 32mm 1fr;
            gap: 4mm;
            font-size: 12px;
            margin-bottom: 5px;
          }

          .info-row span {
            font-weight: 700;
          }

          .info-row span::after {
            content: " :";
            float: right;
          }

          .info-row b {
            font-size: 12px;
          }

          .info-row:first-child b {
            font-size: 20px;
            letter-spacing: 0.4px;
          }

          .address-line b {
            border: 1px solid #000;
            padding: 5px 7px;
            min-height: 24px;
            display: block;
          }

          .barcode-box {
            border: 1px dashed #000;
            padding: 4mm 5mm 3mm;
            text-align: center;
            position: relative;
          }

          .barcode-label {
            position: absolute;
            top: -11px;
            left: 50%;
            transform: translateX(-50%);
            background: #000;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 18px;
            white-space: nowrap;
          }

          .barcode {
            width: 68mm;
            height: 18mm;
            display: block;
            margin: 0 auto;
          }

          .barcode-text {
            font-size: 16px;
            font-weight: 700;
            margin-top: -2px;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 4mm;
          }

          .items-table th,
          .items-table td {
            border: 1px solid #000;
            padding: 5px 6px;
            font-size: 11px;
          }

          .items-table th {
            background: #000;
            color: #fff;
            text-align: center;
            font-weight: 700;
          }

          .sl-head, .sl-cell {
            width: 12mm;
            text-align: center;
          }

          .small-head {
            width: 26mm;
          }

          .qty-head {
            width: 20mm;
          }

          .product-cell {
            font-family: "NotoSansBengali", Arial, sans-serif;
            word-break: break-word;
          }

          .num-cell {
            text-align: center;
          }

          .invoice-half .items-table td {
            height: 8mm;
          }

          .bottom-grid {
            display: grid;
            grid-template-columns: 1fr 62mm;
            gap: 8mm;
          }

          .mini-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            border: 1px solid #000;
            margin-bottom: 4mm;
          }

          .mini-summary div {
            padding: 6px 10px;
            border-right: 1px solid #000;
            min-height: 17mm;
          }

          .mini-summary div:last-child {
            border-right: none;
          }

          .mini-summary span {
            display: block;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .mini-summary b {
            display: block;
            margin-top: 4px;
            font-size: 14px;
          }

          .note-box {
            border: 1px solid #000;
            min-height: 19mm;
            padding: 6px 8px;
            font-size: 11px;
          }

          .note-box strong {
            margin-right: 6px;
          }

          .total-box {
            border: 1px solid #000;
            font-size: 11px;
          }

          .total-box div {
            display: flex;
            justify-content: space-between;
            padding: 5px 8px;
            border-bottom: 1px solid #000;
          }

          .total-box .grand {
            background: #000;
            color: #fff;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .total-box p {
            margin: 7px 8px 5px;
            text-align: center;
            font-weight: 700;
            word-break: break-word;
          }

          .cut-line {
            margin-top: 4mm;
            font-size: 10px;
            white-space: nowrap;
          }

          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>

      <body>
        ${invoiceBlocks}

        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script>
          window.addEventListener("load", function () {
            document.querySelectorAll(".barcode").forEach(function (el) {
              var code = el.getAttribute("data-code");

              if (!code || typeof JsBarcode === "undefined") return;

              JsBarcode(el, code, {
                format: "CODE128",
                displayValue: false,
                margin: 0,
                width: 1.4,
                height: 48,
                background: "#ffffff",
                lineColor: "#000000"
              });
            });
          });
        </script>
      </body>
    </html>
  `;
}

function resolveChromeExecutablePath(fs: any) {
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
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const fs = await import("fs");
  const path = await import("path");
  const puppeteer = (await import("puppeteer-core")).default;

  const fontPath = path
    .join(process.cwd(), "public", "fonts", "NotoSansBengali-Regular.ttf")
    .replace(/\\/g, "/");

  const { prisma } = await import("@/lib/prisma");
  const { batchId } = await context.params;

  const batch = await prisma.invoiceBatch.findUnique({
    where: { id: batchId },
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
    discount: Number(item.order.discount || 0),
    advance: Number(item.order.advance || 0),
    deliveryCharge: Number(item.order.deliveryCharge || 0),
    totalAmount: Number(item.order.totalAmount || 0),
    createdAt: item.order.createdAt,
    pageName: item.order.page?.name || "Invoice",
    note: item.order.note || "",
    items: item.order.items.map((orderItem) => ({
      productName: orderItem.productName || "",
      quantity: orderItem.quantity,
      unitPrice: Number(orderItem.unitPrice || 0),
      lineTotal: Number(orderItem.lineTotal || 0),
    })),
  }));

  const html = buildInvoiceHtml(orders, fontPath);
  const executablePath = resolveChromeExecutablePath(fs);

  if (!executablePath) {
    return new Response(
      "PDF generation failed: Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH.",
      { status: 500 }
    );
  }

  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      executablePath,
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