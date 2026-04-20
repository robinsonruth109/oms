"use client";

import { useState } from "react";
import RestoreButton from "./restore-button";

type GroupedStockOutRow = {
  productSku: string;
  productName: string;
  totalInvoiceQty: number;
  totalProductQty: number;
  totalProductPrice: number;
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
  }[];
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

export default function StockOutClient({
  rows,
}: {
  rows: GroupedStockOutRow[];
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

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
        <h1 className="text-2xl font-bold text-slate-900">Stock Out Items</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock out orders grouped by product SKU. Use product-wise restore or expand to restore invoice-wise one by one.
        </p>
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
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expand
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product Restore
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
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

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.productSku)}
                          className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? "Hide" : "Expand"}
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        <RestoreButton
                          orderIds={row.orderIds}
                          label="Restore All"
                        />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b bg-slate-50/60">
                        <td colSpan={7} className="px-6 py-5">
                          <div className="rounded-2xl border bg-white">
                            <div className="border-b px-4 py-3">
                              <h3 className="text-sm font-semibold text-slate-900">
                                Invoice-wise Restore List
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Restore individual invoices one by one using delivery charge and invoice details.
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
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Action
                                    </th>
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

                                      <td className="px-4 py-3">
                                        <RestoreButton
                                          orderIds={[invoice.orderId]}
                                          label="Restore"
                                        />
                                      </td>
                                    </tr>
                                  ))}

                                  {!row.invoices.length && (
                                    <tr>
                                      <td
                                        colSpan={7}
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

              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No stock out items found.
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