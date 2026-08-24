"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  StockOutCommitRow,
  StockOutPreviewRow,
} from "@/lib/stock-out-restore";

type MasterData = {
  pages: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  couriers: { slug: string; name: string }[];
  products: {
    id: string;
    sku: string;
    name: string;
    parentSku: string;
    sellingPrice: number;
  }[];
};

type ReviewItem = StockOutPreviewRow["items"][number] & {
  productId: string;
};

type ReviewRow = Omit<StockOutPreviewRow, "items"> & {
  include: boolean;
  pageId: string;
  sourceId: string;
  courierSlug: string;
  items: ReviewItem[];
};

type CommitResult = {
  success: boolean;
  partialSuccess?: boolean;
  batchNo?: string;
  importedCount?: number;
  restoredCount?: number;
  skippedCount?: number;
  failedCount?: number;
  message: string;
  results?: {
    rowNumber: number;
    invoiceId: string;
    status: string;
    message: string;
    orderId?: string;
  }[];
};

function isRowReady(row: ReviewRow) {
  if (!row.include) return true;
  if (row.action === "BLOCKED") return false;

  return Boolean(
    row.invoiceId &&
      row.pageId &&
      row.sourceId &&
      row.courierSlug &&
      row.importedDate &&
      row.customerName.trim() &&
      row.phone.trim() &&
      row.address.trim() &&
      row.items.length &&
      row.items.every((item) => item.productId)
  );
}

function rowIssues(row: ReviewRow) {
  const issues: string[] = [];

  if (!row.invoiceId) issues.push("invoice");
  if (!row.pageId) issues.push("page");
  if (!row.sourceId) issues.push("source");
  if (!row.courierSlug) issues.push("courier");
  if (!row.importedDate) issues.push("import date");
  if (!row.customerName.trim()) issues.push("customer");
  if (!row.phone.trim()) issues.push("phone");
  if (!row.address.trim()) issues.push("address");
  if (!row.items.length) issues.push("product");
  if (row.items.some((item) => !item.productId)) issues.push("product match");

  return issues;
}

export default function StockOutImportClient({
  masters,
}: {
  masters: MasterData;
}) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const productById = useMemo(
    () => new Map(masters.products.map((product) => [product.id, product])),
    [masters.products]
  );

  const included = rows.filter((row) => row.include);
  const readyIncluded = included.filter(isRowReady);
  const allIncludedReady =
    included.length > 0 && readyIncluded.length === included.length;

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  }

  function updateItem(
    rowIndex: number,
    itemIndex: number,
    patch: Partial<ReviewRow["items"][number]>
  ) {
    setRows((current) =>
      current.map((row, currentRowIndex) => {
        if (currentRowIndex !== rowIndex) return row;

        return {
          ...row,
          items: row.items.map((item, currentItemIndex) =>
            currentItemIndex === itemIndex ? { ...item, ...patch } : item
          ),
        };
      })
    );
  }

  async function previewFile() {
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setMessage("Choose a CSV file first.");
      return;
    }

    setPreviewLoading(true);
    setMessage("");
    setCommitResult(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/stock-out-restore/preview", {
        method: "POST",
        body: formData,
      });

      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new Error(body.message || "CSV preview failed.");
      }

      const reviewRows: ReviewRow[] = (
        body.rows as StockOutPreviewRow[]
      ).map((row) => ({
        ...row,
        include: row.action !== "BLOCKED",
        pageId: row.suggestedPageId || "",
        sourceId: row.suggestedSourceId || "",
        courierSlug: row.suggestedCourierSlug || "",
        items: row.items.map((item) => ({
          ...item,
          productId: item.suggestedProductId || "",
        })),
      }));

      setRows(reviewRows);
      setFileName(body.fileName || file.name);
      setMessage(
        `Preview loaded: ${body.summary.total} rows · ${body.summary.newOrders} new · ${body.summary.restoreOrders} STOCK_OUT restore · ${body.summary.blocked} blocked.`
      );
    } catch (error) {
      setRows([]);
      setMessage(
        error instanceof Error ? error.message : "CSV preview failed."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function applyBulk(field: "pageId" | "sourceId" | "courierSlug", value: string) {
    if (!value) return;

    setRows((current) =>
      current.map((row) =>
        row.include && row.action !== "BLOCKED"
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  async function commitRows() {
    if (!allIncludedReady) {
      setMessage("Fix every included row before sending to Ready to Ship.");
      return;
    }

    const payloadRows: StockOutCommitRow[] = included.map((row) => ({
      include: true,
      rowNumber: row.rowNumber,
      invoiceId: row.invoiceId,
      pageId: row.pageId,
      sourceId: row.sourceId,
      courierSlug: row.courierSlug,
      importedDate: row.importedDate,
      customerName: row.customerName,
      phone: row.phone,
      address: row.address,
      deliveryCharge: row.deliveryCharge,
      discount: row.discount,
      grandTotal: row.grandTotal,
      action: row.action === "RESTORE" ? "RESTORE" : "CREATE",
      existingOrderId: row.existingOrderId,
      items: row.items.map((item) => {
        const product = productById.get(item.productId);

        return {
          productId: item.productId,
          csvSku: item.csvSku,
          csvParentCode: item.csvParentCode,
          name: product?.name || item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice || product?.sellingPrice || 0,
        };
      }),
    }));

    setCommitLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/stock-out-restore/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          rows: payloadRows,
        }),
      });

      const body = (await response.json()) as CommitResult;

      if (!response.ok) {
        throw new Error(body.message || "Import failed.");
      }

      setCommitResult(body);
      setMessage(body.message);

      if (body.importedCount || body.restoredCount) {
        // Prevent accidental second submission from the same preview.
        setRows((current) => current.map((row) => ({ ...row, include: false })));
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Import commit failed."
      );
    } finally {
      setCommitLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          1. Upload Historical Stock Out CSV
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Nothing is written to OMS during preview. Review and fix every row first.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-2 text-sm">
            <span className="font-medium text-slate-700">CSV File</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full rounded-xl border bg-white px-3 py-2.5"
            />
          </label>

          <Button
            type="button"
            disabled={previewLoading}
            onClick={previewFile}
          >
            {previewLoading ? "Reading CSV..." : "Upload + Review"}
          </Button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>

      {rows.length ? (
        <>
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold">
                2. Bulk Defaults (optional)
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Apply Page, Source or Courier once to all included rows, then adjust individual rows if needed.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Set Page for included rows</span>
                <select
                  defaultValue=""
                  className="w-full rounded-xl border px-3 py-2.5"
                  onChange={(event) => applyBulk("pageId", event.target.value)}
                >
                  <option value="">Choose page...</option>
                  {masters.pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Set Source for included rows</span>
                <select
                  defaultValue=""
                  className="w-full rounded-xl border px-3 py-2.5"
                  onChange={(event) => applyBulk("sourceId", event.target.value)}
                >
                  <option value="">Choose source...</option>
                  {masters.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Set Courier for included rows</span>
                <select
                  defaultValue=""
                  className="w-full rounded-xl border px-3 py-2.5"
                  onChange={(event) =>
                    applyBulk("courierSlug", event.target.value)
                  }
                >
                  <option value="">Choose courier...</option>
                  {masters.couriers.map((courier) => (
                    <option key={courier.slug} value={courier.slug}>
                      {courier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">3. Review Every Row</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Included: {included.length} · Verified: {readyIncluded.length}
                  </p>
                </div>

                <div
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    allIncludedReady
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {allIncludedReady
                    ? "All included rows verified"
                    : `${included.length - readyIncluded.length} row(s) need attention`}
                </div>
              </div>
            </div>

            <datalist id="stock-out-products">
              {masters.products.map((product) => (
                <option
                  key={product.id}
                  value={product.sku}
                >{`${product.name} | Parent: ${product.parentSku}`}</option>
              ))}
            </datalist>

            <div className="space-y-4 p-4">
              {rows.map((row, rowIndex) => {
                const issues = rowIssues(row);
                const ready = isRowReady(row);

                return (
                  <article
                    key={`${row.rowNumber}-${row.invoiceId}`}
                    className={`rounded-2xl border p-4 ${
                      row.action === "BLOCKED"
                        ? "border-red-200 bg-red-50"
                        : ready
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={row.action === "BLOCKED"}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              include: event.target.checked,
                            })
                          }
                          className="mt-1 h-4 w-4"
                        />

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              Row {row.rowNumber} · {row.invoiceId || "No Invoice"}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                row.action === "CREATE"
                                  ? "bg-blue-100 text-blue-700"
                                  : row.action === "RESTORE"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {row.action}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {row.message}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          ready
                            ? "bg-emerald-100 text-emerald-700"
                            : row.include
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {ready
                          ? "READY"
                          : row.include
                          ? `Needs: ${issues.join(", ")}`
                          : "SKIPPED"}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Import Date</span>
                        <input
                          type="date"
                          value={row.importedDate}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              importedDate: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Page</span>
                        <select
                          value={row.pageId}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              pageId: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Select page...</option>
                          {masters.pages.map((page) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">
                          CSV: {row.pageName || "N/A"}
                        </p>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Source</span>
                        <select
                          value={row.sourceId}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              sourceId: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Select source...</option>
                          {masters.sources.map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Courier</span>
                        <select
                          value={row.courierSlug}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              courierSlug: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Select courier...</option>
                          {masters.couriers.map((courier) => (
                            <option key={courier.slug} value={courier.slug}>
                              {courier.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Customer</span>
                        <input
                          value={row.customerName}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              customerName: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Phone</span>
                        <input
                          value={row.phone}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              phone: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        />
                      </label>

                      <label className="space-y-1.5 text-sm md:col-span-2">
                        <span className="font-medium">Address</span>
                        <input
                          value={row.address}
                          disabled={!row.include}
                          onChange={(event) =>
                            updateRow(rowIndex, {
                              address: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2"
                        />
                      </label>
                    </div>

                    <div className="mt-4 rounded-2xl border bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold">Products</h4>
                        <p className="text-xs text-slate-500">
                          Exact SKU is auto-matched first.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {row.items.map((item, itemIndex) => {
                          const selectedProduct = productById.get(
                            item.productId
                          );

                          return (
                            <div
                              key={`${item.position}-${item.csvSku}`}
                              className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 lg:grid-cols-[2fr_1fr_1fr]"
                            >
                              <label className="space-y-1.5 text-sm">
                                <span className="font-medium">
                                  Product {item.position}
                                </span>
                                <select
                                  value={item.productId}
                                  disabled={!row.include}
                                  onChange={(event) =>
                                    updateItem(rowIndex, itemIndex, {
                                      productId: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border bg-white px-3 py-2"
                                >
                                  <option value="">Select product...</option>
                                  {item.suggestedProductId &&
                                  productById.has(item.suggestedProductId) ? (
                                    <option value={item.suggestedProductId}>
                                      {item.suggestedProductSku} —{" "}
                                      {item.suggestedProductName}
                                    </option>
                                  ) : null}
                                  {masters.products
                                    .filter(
                                      (product) =>
                                        product.id !== item.suggestedProductId
                                    )
                                    .map((product) => (
                                      <option
                                        key={product.id}
                                        value={product.id}
                                      >
                                        {product.sku} — {product.name}
                                      </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500">
                                  CSV SKU: {item.csvSku || "N/A"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Match: {item.matchedBy}
                                  {selectedProduct
                                    ? ` → ${selectedProduct.sku}`
                                    : ""}
                                </p>
                              </label>

                              <label className="space-y-1.5 text-sm">
                                <span className="font-medium">Quantity</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  disabled={!row.include}
                                  onChange={(event) =>
                                    updateItem(rowIndex, itemIndex, {
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value || 1)
                                      ),
                                    })
                                  }
                                  className="w-full rounded-xl border bg-white px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1.5 text-sm">
                                <span className="font-medium">Unit Price</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  disabled={!row.include}
                                  onChange={(event) =>
                                    updateItem(rowIndex, itemIndex, {
                                      unitPrice: Math.max(
                                        0,
                                        Number(event.target.value || 0)
                                      ),
                                    })
                                  }
                                  className="w-full rounded-xl border bg-white px-3 py-2"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Delivery</p>
                        <p className="font-semibold">৳{row.deliveryCharge}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Discount</p>
                        <p className="font-semibold">৳{row.discount}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Grand Total</p>
                        <p className="font-semibold">৳{row.grandTotal}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="sticky bottom-4 rounded-3xl border bg-white/95 p-5 shadow-xl backdrop-blur">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-bold text-slate-900">
                  4. Send Verified Orders to Ready to Ship
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  New rows preserve the CSV import date as Order.createdAt.
                  Ready To Ship date becomes today. Existing STOCK_OUT invoices
                  are restored instead of duplicated.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                disabled={!allIncludedReady || commitLoading}
                onClick={commitRows}
              >
                {commitLoading
                  ? "Sending..."
                  : `Send ${included.length} Verified Order(s) to Ready To Ship`}
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {commitResult ? (
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Import Result</h2>
              <p className="mt-1 text-sm text-slate-500">
                Batch: {commitResult.batchNo || "N/A"}
              </p>
            </div>

            {(commitResult.importedCount || 0) +
              (commitResult.restoredCount || 0) >
            0 ? (
              <Link
                href="/dashboard/ready-to-ship"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open Ready to Ship
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-3">
              <p className="text-xs text-blue-600">Imported</p>
              <p className="text-2xl font-bold text-blue-900">
                {commitResult.importedCount || 0}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs text-violet-600">Restored</p>
              <p className="text-2xl font-bold text-violet-900">
                {commitResult.restoredCount || 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Skipped</p>
              <p className="text-2xl font-bold">
                {commitResult.skippedCount || 0}
              </p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-900">
                {commitResult.failedCount || 0}
              </p>
            </div>
          </div>

          {commitResult.results?.length ? (
            <div className="mt-5 overflow-x-auto rounded-2xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {commitResult.results.map((result) => (
                    <tr
                      key={`${result.rowNumber}-${result.invoiceId}`}
                      className="border-t"
                    >
                      <td className="px-4 py-3">{result.rowNumber}</td>
                      <td className="px-4 py-3 font-semibold">
                        {result.invoiceId}
                      </td>
                      <td className="px-4 py-3">{result.status}</td>
                      <td className="px-4 py-3">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
