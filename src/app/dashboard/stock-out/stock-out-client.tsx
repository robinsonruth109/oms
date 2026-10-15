"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import RestoreButton from "./restore-button";
import TrashStockOutButton from "./trash-stock-out-button";

type GroupedStockOutRow = {
  productSku: string;
  productName: string;
  totalInvoiceQty: number;
  totalProductQty: number;
  totalProductPrice: number;
  parentSkus: string[];
  pageSources: string[];
  orderIds: string[];
  invoices: {
    orderId: string;
    invoiceId: string | null;
    customerName: string;
    phone: string;
    quantity: number;
    lineTotal: number;
    deliveryCharge: number;
    pageName: string;
    sourceName: string;
    parentSku: string;
    stockOutAt: string;
  }[];
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function bangladeshDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function formatStockOutDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function StockOutClient({
  stockOutRows,
  trashRows,
}: {
  stockOutRows: GroupedStockOutRow[];
  trashRows: GroupedStockOutRow[];
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [view, setView] = useState<"STOCK_OUT" | "TRASH">("STOCK_OUT");
  const rows = view === "STOCK_OUT" ? stockOutRows : trashRows;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [parentSearch, setParentSearch] = useState("");

  const filteredRows = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();

    return rows
      .map((row) => {
        const invoices = row.invoices.filter((invoice) => {
          const dateKey = bangladeshDateKey(invoice.stockOutAt);

          if (fromDate && dateKey < fromDate) return false;
          if (toDate && dateKey > toDate) return false;

          if (
            query &&
            !invoice.parentSku.toLowerCase().includes(query) &&
            !row.parentSkus.some((sku) => sku.toLowerCase().includes(query))
          ) {
            return false;
          }

          return true;
        });

        if (!invoices.length) return null;

        return {
          ...row,
          invoices,
          orderIds: Array.from(new Set(invoices.map((invoice) => invoice.orderId))),
          totalInvoiceQty: invoices.length,
          totalProductQty: invoices.reduce(
            (sum, invoice) => sum + invoice.quantity,
            0
          ),
          totalProductPrice: invoices.reduce(
            (sum, invoice) => sum + invoice.lineTotal,
            0
          ),
          pageSources: Array.from(
            new Set(
              invoices.map(
                (invoice) => `${invoice.pageName} / ${invoice.sourceName}`
              )
            )
          ),
        };
      })
      .filter((row): row is GroupedStockOutRow => Boolean(row));
  }, [rows, fromDate, toDate, parentSearch]);

  const filtersActive = Boolean(fromDate || toDate || parentSearch.trim());

  const summary = useMemo(
    () => ({
      totalProductTypes: filteredRows.length,
      totalInvoices: filteredRows.reduce(
        (sum, row) => sum + row.totalInvoiceQty,
        0
      ),
      totalInvoiceValue: filteredRows.reduce(
        (sum, row) => sum + row.totalProductPrice,
        0
      ),
    }),
    [filteredRows]
  );

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setParentSearch("");
  }

  function toggleExpand(productSku: string) {
    setExpandedKeys((prev) =>
      prev.includes(productSku)
        ? prev.filter((item) => item !== productSku)
        : [...prev, productSku]
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {view === "STOCK_OUT" ? "Stock Out Items" : "Trash Items"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {view === "STOCK_OUT"
                ? "Stock out orders grouped by product SKU. Filter by stock-out date or search by Product Master parent code."
                : "Invoices moved to Trash without restoring stock. Track them separately from active stock-out items."}
            </p>
          </div>

          <div className="inline-flex rounded-xl border bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setView("STOCK_OUT");
                setExpandedKeys([]);
              }}
              className={
                "rounded-lg px-3 py-2 text-sm font-semibold transition " +
                (view === "STOCK_OUT"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white")
              }
            >
              Stock Out ({stockOutRows.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setView("TRASH");
                setExpandedKeys([]);
              }}
              className={
                "rounded-lg px-3 py-2 text-sm font-semibold transition " +
                (view === "TRASH"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-700 hover:bg-white")
              }
            >
              Trash ({trashRows.length})
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto] lg:items-end">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parent Code Search
            </span>
            <div className="flex min-h-11 items-center gap-2 rounded-xl border px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={parentSearch}
                onChange={(event) => setParentSearch(event.target.value)}
                placeholder="Search parent SKU, e.g. Code-134"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {view === "STOCK_OUT" ? "From Stock-out Date" : "From Trash Date"}
            </span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className="min-h-11 w-full rounded-xl border px-3 text-sm outline-none"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {view === "STOCK_OUT" ? "To Stock-out Date" : "To Trash Date"}
            </span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="min-h-11 w-full rounded-xl border px-3 text-sm outline-none"
            />
          </label>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredRows.length}</strong> product{filteredRows.length === 1 ? "" : "s"}
          </span>
          {fromDate || toDate ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
              Date: {fromDate || "Any"} → {toDate || "Any"}
            </span>
          ) : null}
          {parentSearch.trim() ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              Parent: {parentSearch.trim()}
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Product Types
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary.totalProductTypes.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {view === "STOCK_OUT"
              ? "Unique stock-out product SKUs in the current filter"
              : "Unique trashed product SKUs in the current filter"}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Invoices
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary.totalInvoices.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {view === "STOCK_OUT"
              ? "Stock-out invoice lines in the current filter"
              : "Trashed invoice lines in the current filter"}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Invoice Value
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMoney(summary.totalInvoiceValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {view === "STOCK_OUT"
              ? "Product value of the filtered stock-out invoices"
              : "Product value of the filtered trashed invoices"}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Invoice Qty
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Product Qty
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Product Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page / Source
                </th>
                {view === "STOCK_OUT" ? (
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Trash
                  </th>
                ) : null}
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expand
                </th>
                {view === "STOCK_OUT" ? (
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Product Restore
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const isExpanded = expandedKeys.includes(row.productSku);

                return (
                  <>
                    <tr key={row.productSku} className="border-b">
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div>
                          <p className="font-medium text-slate-900">
                            {row.productName}
                          </p>
                          <p className="text-slate-500">{row.productSku}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {row.totalInvoiceQty}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {row.totalProductQty}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {formatMoney(row.totalProductPrice)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="space-y-1">
                          {row.pageSources.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </td>

                      {view === "STOCK_OUT" ? (
                        <td className="px-6 py-4">
                          <TrashStockOutButton
                            orderIds={row.orderIds}
                            invoiceCount={row.totalInvoiceQty}
                          />
                        </td>
                      ) : null}

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.productSku)}
                          className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? "Hide" : "Expand"}
                        </button>
                      </td>

                      {view === "STOCK_OUT" ? (
                        <td className="px-6 py-4">
                          <RestoreButton
                            orderIds={row.orderIds}
                            label="Restore All"
                          />
                        </td>
                      ) : null}
                    </tr>

                    {isExpanded && (
                      <tr className="border-b bg-slate-50/60">
                        <td colSpan={view === "STOCK_OUT" ? 8 : 6} className="px-6 py-5">
                          <div className="rounded-2xl border bg-white">
                            <div className="border-b px-4 py-3">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {view === "STOCK_OUT"
                                  ? "Invoice-wise Restore List"
                                  : "Trashed Invoice List"}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                {view === "STOCK_OUT"
                                  ? "Restore individual invoices one by one using delivery charge and invoice details."
                                  : "These invoices were moved to Trash without restoring inventory."}
                              </p>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead className="bg-slate-50">
                                  <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Invoice
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      {view === "STOCK_OUT" ? "Stock-out Date" : "Trash Date"}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Customer
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Qty
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Product Total
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Delivery Charge
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Page / Source
                                    </th>
                                    {view === "STOCK_OUT" ? (
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Action
                                      </th>
                                    ) : null}
                                  </tr>
                                </thead>

                                <tbody>
                                  {row.invoices.map((invoice, index) => (
                                    <tr
                                      key={`${invoice.orderId}-${index}`}
                                      className="border-b last:border-b-0"
                                    >
                                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                        {invoice.invoiceId || "N/A"}
                                      </td>

                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        {formatStockOutDate(invoice.stockOutAt)}
                                      </td>

                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        <div>
                                          <p className="font-medium text-slate-900">
                                            {invoice.customerName}
                                          </p>
                                          <p className="text-slate-500">
                                            {invoice.phone}
                                          </p>
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        {invoice.quantity}
                                      </td>

                                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                        {formatMoney(invoice.lineTotal)}
                                      </td>

                                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                        {formatMoney(invoice.deliveryCharge)}
                                      </td>

                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        {invoice.pageName} / {invoice.sourceName}
                                      </td>

                                      {view === "STOCK_OUT" ? (
                                        <td className="px-4 py-3">
                                          <RestoreButton
                                            orderIds={[invoice.orderId]}
                                            label="Restore"
                                          />
                                        </td>
                                      ) : null}
                                    </tr>
                                  ))}

                                  {!row.invoices.length && (
                                    <tr>
                                      <td
                                        colSpan={view === "STOCK_OUT" ? 8 : 7}
                                        className="px-4 py-6 text-center text-sm text-slate-500"
                                      >
                                        No invoice rows found.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={view === "STOCK_OUT" ? 8 : 6}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {filtersActive
                      ? view === "STOCK_OUT"
                        ? "No stock out items match the selected filters."
                        : "No trash items match the selected filters."
                      : view === "STOCK_OUT"
                        ? "No stock out items found."
                        : "No trash items found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}