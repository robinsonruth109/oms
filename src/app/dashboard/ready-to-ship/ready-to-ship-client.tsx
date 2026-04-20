"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { createCsvBatch, createInvoiceBatch } from "./actions";

type OrderRow = {
  id: string;
  invoiceId: string | null;
  customerName: string;
  phone: string;
  courier: string | null;
  totalAmount: number;
  createdAt: string;
  items: {
    id: string;
    productSku: string;
    quantity: number;
  }[];
};

type BatchRow = {
  id: string;
  batchNo: string;
  courier: string;
  totalOrders: number;
  createdAt: string;
  createdByName: string;
  downloadUrl?: string;
};

type Props = {
  courier: string;
  activeTab: string;
  courierMap: Record<string, string>;
  orders: OrderRow[];
  invoiceBatches: BatchRow[];
  csvBatches: BatchRow[];
};

const initialState = {
  success: false,
  message: "",
  batchId: undefined as string | undefined,
  downloadUrl: undefined as string | undefined,
};

function CourierLabel({
  courier,
  courierMap,
}: {
  courier: string | null;
  courierMap: Record<string, string>;
}) {
  if (!courier) return <span className="text-slate-400">N/A</span>;
  return <span>{courierMap[courier] || courier}</span>;
}

export default function ReadyToShipClient({
  courier,
  activeTab,
  courierMap,
  orders,
  invoiceBatches,
  csvBatches,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceState, invoiceAction, invoicePending] = useActionState(
    createInvoiceBatch,
    initialState
  );
  const [csvState, csvAction, csvPending] = useActionState(
    createCsvBatch,
    initialState
  );

  useEffect(() => {
    if (invoiceState.success && invoiceState.downloadUrl) {
      window.location.href = invoiceState.downloadUrl;
      setSelectedIds([]);
    }
  }, [invoiceState]);

  useEffect(() => {
    if (csvState.success && csvState.downloadUrl) {
      window.location.href = csvState.downloadUrl;
      setSelectedIds([]);
    }
  }, [csvState]);

  const allSelected = useMemo(() => {
    return orders.length > 0 && selectedIds.length === orders.length;
  }, [orders.length, selectedIds.length]);

  function toggleOrder(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((order) => order.id));
    }
  }

  const flashMessage = invoiceState.message || csvState.message;
  const flashSuccess = invoiceState.success || csvState.success;

  return (
    <div className="space-y-6">
      {flashMessage && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            flashSuccess
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {flashMessage}
        </div>
      )}

      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {activeTab === "non-invoiced" && "Non Invoiced Orders"}
            {activeTab === "invoiced" && "Invoice Downloaded Orders"}
            {activeTab === "non-csv" && "Non CSV Orders"}
            {activeTab === "csv-downloaded" && "CSV Downloaded Orders"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Filtered by ready-to-ship orders and selected courier/date.
          </p>
        </div>

        {activeTab === "non-invoiced" && (
          <div className="border-b bg-slate-50 px-5 py-4 sm:px-6">
            <form
              action={invoiceAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input
                type="hidden"
                name="selectedIds"
                value={JSON.stringify(selectedIds)}
              />
              <input type="hidden" name="courier" value={courier} />
              <Button
                type="submit"
                disabled={invoicePending || !selectedIds.length}
              >
                {invoicePending
                  ? "Creating Invoice Batch..."
                  : "Create Invoice Batch + Download PDF"}
              </Button>
            </form>
          </div>
        )}

        {activeTab === "non-csv" && (
          <div className="border-b bg-slate-50 px-5 py-4 sm:px-6">
            <form
              action={csvAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input
                type="hidden"
                name="selectedIds"
                value={JSON.stringify(selectedIds)}
              />
              <input type="hidden" name="courier" value={courier} />
              <Button type="submit" disabled={csvPending || !selectedIds.length}>
                {csvPending
                  ? "Creating CSV Batch..."
                  : "Create CSV Batch + Download CSV"}
              </Button>
            </form>
          </div>
        )}

        <div className="space-y-4 p-4 lg:hidden">
          {(activeTab === "non-invoiced" || activeTab === "non-csv") &&
            orders.length > 0 && (
              <div className="rounded-2xl border bg-slate-50 p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                  Select all shown orders
                </label>
              </div>
            )}

          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {order.invoiceId || "N/A"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {order.customerName} · {order.phone}
                  </p>
                </div>

                {(activeTab === "non-invoiced" || activeTab === "non-csv") && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleOrder(order.id)}
                  />
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Courier</p>
                  <p className="font-medium text-slate-800">
                    <CourierLabel
                      courier={order.courier}
                      courierMap={courierMap}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Total</p>
                  <p className="font-medium text-slate-800">
                    ৳ {order.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400">Items</p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <p key={item.id} className="font-medium text-slate-800">
                        {item.productSku} × {item.quantity}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!orders.length && (
            <div className="p-6 text-sm text-slate-500">No orders found.</div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                {(activeTab === "non-invoiced" || activeTab === "non-csv") && (
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Courier
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Items
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-b-0">
                  {(activeTab === "non-invoiced" || activeTab === "non-csv") && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleOrder(order.id)}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {order.invoiceId || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <p className="text-slate-500">{order.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <CourierLabel
                      courier={order.courier}
                      courierMap={courierMap}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <p key={item.id}>
                          {item.productSku} × {item.quantity}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    ৳ {order.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {order.createdAt}
                  </td>
                </tr>
              ))}

              {!orders.length && (
                <tr>
                  <td
                    colSpan={
                      activeTab === "non-invoiced" || activeTab === "non-csv"
                        ? 7
                        : 6
                    }
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Invoice Batches
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Download history for invoice operations.
            </p>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {invoiceBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {batch.batchNo}
                      </p>
                      <p className="text-sm text-slate-500">
                        <CourierLabel
                          courier={batch.courier}
                          courierMap={courierMap}
                        />
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-slate-700">
                        {batch.totalOrders} orders
                      </p>
                      {batch.downloadUrl ? (
                        <a
                          href={batch.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Download PDF
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    By {batch.createdByName} on {batch.createdAt}
                  </p>
                </div>
              ))}

              {!invoiceBatches.length && (
                <p className="text-sm text-slate-500">No invoice batches yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-slate-900">
              CSV Batches
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Download history for courier CSV operations.
            </p>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {csvBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {batch.batchNo}
                      </p>
                      <p className="text-sm text-slate-500">
                        <CourierLabel
                          courier={batch.courier}
                          courierMap={courierMap}
                        />
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-slate-700">
                        {batch.totalOrders} orders
                      </p>
                      {batch.downloadUrl ? (
                        <a
                          href={batch.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Download CSV
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    By {batch.createdByName} on {batch.createdAt}
                  </p>
                </div>
              ))}

              {!csvBatches.length && (
                <p className="text-sm text-slate-500">No CSV batches yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}