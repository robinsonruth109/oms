"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCsvBatch,
  createInvoiceBatch,
  pushAllToAssignedCouriers,
  resetCourierIdByInvoice,
} from "./actions";

type OrderRow = {
  id: string;
  invoiceId: string | null;
  orderKind: string;
  customerName: string;
  phone: string;
  courier: string | null;
  totalAmount: number;
  createdAt: string;
  pathaoSubmissionStatus: string;
  pathaoConsignmentId: string | null;
  pathaoOrderStatus: string | null;
  pathaoLastError: string | null;
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
  canResetCourierId: boolean;
  fromDate: string;
  toDate: string;
  bangladeshToday: string;
  canCreateInvoiceBatch: boolean;
  courierMap: Record<string, string>;
  selectedCourierConfigured: boolean;
  nonCsvCount: number;
  orders: OrderRow[];
  invoiceBatches: BatchRow[];
  csvBatches: BatchRow[];
};

const initialState = {
  success: false,
  message: "",
  warning: false,
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
  canResetCourierId,
  fromDate,
  toDate,
  bangladeshToday,
  canCreateInvoiceBatch,
  courierMap,
  selectedCourierConfigured,
  nonCsvCount,
  orders,
  invoiceBatches,
  csvBatches,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [resetInvoiceId, setResetInvoiceId] = useState("");
  const [invoiceState, invoiceAction, invoicePending] = useActionState(
    createInvoiceBatch,
    initialState
  );
  const [csvState, csvAction, csvPending] = useActionState(
    createCsvBatch,
    initialState
  );
  const [pushAllState, pushAllAction, pushAllPending] = useActionState(
    pushAllToAssignedCouriers,
    initialState
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetCourierIdByInvoice,
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

  useEffect(() => {
    if (resetState.success) {
      setResetInvoiceId("");
      setSelectedIds([]);
      router.refresh();
    }
  }, [resetState.success, resetState.message, router]);

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

  const activeFlash = pushAllState.message
    ? pushAllState
    : csvState.message
      ? csvState
      : invoiceState;
  const flashMessage = activeFlash.message;
  const flashSuccess = activeFlash.success;
  const flashWarning = Boolean(activeFlash.warning);

  return (
    <div className="space-y-6">
      {canResetCourierId ? (
        <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <RotateCcw className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Courier ID Reset
                  </h2>
                  <p className="text-sm text-slate-500">
                    Use only when Pathao shows <strong>Pickup Failed</strong>.
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter the OMS invoice ID. Reset removes the failed Pathao
                consignment link and sends the order back to
                <strong> Non Invoiced</strong> + <strong>Non CSV</strong> so a
                new invoice/courier submission can be created.
              </p>
              <p className="mt-1 text-xs font-medium text-amber-700">
                Physical stock is not restored during this reset. The original
                stock deduction snapshot stays intact, so re-submitting the same
                order cannot deduct stock twice.
              </p>
            </div>

            <form
              action={resetAction}
              className="w-full max-w-xl"
              onSubmit={(event) => {
                const invoice = resetInvoiceId.trim();
                if (!invoice) {
                  event.preventDefault();
                  return;
                }

                const confirmed = window.confirm(
                  `Reset courier ID for invoice ${invoice}?\n\nThis is only for Pickup Failed parcels. The old Pathao consignment ID and current Pathao shipment state will be cleared. The order will return to Non Invoiced + Non CSV. Stock will NOT be restored.`
                );

                if (!confirmed) event.preventDefault();
              }}
            >
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice ID
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  name="invoiceId"
                  value={resetInvoiceId}
                  onChange={(event) => setResetInvoiceId(event.target.value)}
                  placeholder="Example: GS119652"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <Button
                  type="submit"
                  disabled={resetPending || !resetInvoiceId.trim()}
                  className="whitespace-nowrap bg-amber-600 text-white hover:bg-amber-700"
                >
                  {resetPending ? "Resetting..." : "Reset Courier ID"}
                </Button>
              </div>

              {resetState.message ? (
                <div
                  className={
                    "mt-3 rounded-xl px-3 py-2.5 text-sm " +
                    (resetState.success
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700")
                  }
                >
                  {resetState.message}
                </div>
              ) : null}
            </form>
          </div>
        </section>
      ) : null}

      {flashMessage && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            flashWarning
              ? "border border-amber-200 bg-amber-50 text-amber-800"
              : flashSuccess
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {flashMessage}
        </div>
      )}

      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
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

            {activeTab === "non-csv" ? (
              <form
                action={pushAllAction}
                onSubmit={(event) => {
                  const label = courier
                    ? courierMap[courier] || courier
                    : "all assigned couriers";
                  const confirmed = window.confirm(
                    `Push ALL ${nonCsvCount} Non CSV order(s) matching the current filters to ${label}?\n\nOMS will group orders by their assigned courier and submit each group through that courier's Pathao API account. Invalid or unconfigured orders will remain in Non CSV.\n\nLOW STOCK WILL NOT BLOCK SUBMISSION. If required stock is higher than available stock, OMS will still push the order and the stock balance may become negative.`
                  );
                  if (!confirmed) event.preventDefault();
                }}
              >
                <input type="hidden" name="courier" value={courier} />
                <input type="hidden" name="fromDate" value={fromDate} />
                <input type="hidden" name="toDate" value={toDate} />
                <Button
                  type="submit"
                  disabled={pushAllPending || nonCsvCount === 0}
                  className="whitespace-nowrap"
                >
                  {pushAllPending
                    ? "Pushing to Couriers..."
                    : `Push All to Couriers (${nonCsvCount})`}
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {activeTab === "non-invoiced" && (
          <div className="border-b bg-slate-50 px-5 py-4 sm:px-6">
            {!canCreateInvoiceBatch ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Invoice PDF can only be created when both <strong>From Date</strong>{" "}
                and <strong>To Date</strong> are today&apos;s Bangladesh date (
                <strong>{bangladeshToday}</strong>). Future or previous Ready to
                Ship memo dates cannot be invoiced from this button.
              </div>
            ) : null}

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
              <input type="hidden" name="fromDate" value={fromDate} />
              <input type="hidden" name="toDate" value={toDate} />

              <Button
                type="submit"
                disabled={
                  invoicePending ||
                  !selectedIds.length ||
                  !canCreateInvoiceBatch
                }
              >
                {invoicePending
                  ? "Creating Invoice Batch..."
                  : "Create Invoice Batch + Download PDF"}
              </Button>

              {canCreateInvoiceBatch ? (
                <span className="text-xs font-medium text-emerald-700">
                  Today&apos;s Bangladesh memo only · {bangladeshToday}
                </span>
              ) : null}
            </form>
          </div>
        )}

        {activeTab === "non-csv" && (
          <div className="border-b bg-slate-50 px-5 py-4 sm:px-6">
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Stock warning only:</strong> low stock will not stop courier submission.
              After Pathao accepts the order, OMS will deduct the required quantity and stock can go below zero if needed.
            </div>
            {!courier ? (
              <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Select one courier from the filter before creating a Pathao CSV batch. The backend will only submit orders belonging to that selected courier.
              </div>
            ) : !selectedCourierConfigured ? (
              <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                This courier is not fully configured for Pathao API. Configure and test it in Courier Master first.
              </div>
            ) : null}
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
              <Button
                type="submit"
                disabled={
                  csvPending ||
                  !selectedIds.length ||
                  !courier ||
                  !selectedCourierConfigured
                }
              >
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {order.invoiceId || "N/A"}
                    </h3>
                    {order.orderKind === "EXCHANGE" ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                        EXCHANGE
                      </span>
                    ) : null}
                  </div>
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
                  <p className="text-slate-400">Pathao</p>
                  <p className="font-medium text-slate-800">
                    {order.pathaoConsignmentId
                      ? `${order.pathaoConsignmentId} · ${order.pathaoOrderStatus || order.pathaoSubmissionStatus}`
                      : order.pathaoSubmissionStatus}
                  </p>
                  {order.pathaoLastError ? (
                    <p className="mt-1 text-xs text-red-600">{order.pathaoLastError}</p>
                  ) : null}
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
                  Pathao
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{order.invoiceId || "N/A"}</span>
                      {order.orderKind === "EXCHANGE" ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                          EXCHANGE
                        </span>
                      ) : null}
                    </div>
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
                      <p className="font-medium">
                        {order.pathaoConsignmentId || order.pathaoSubmissionStatus}
                      </p>
                      {order.pathaoOrderStatus ? (
                        <p className="text-xs text-slate-500">{order.pathaoOrderStatus}</p>
                      ) : null}
                      {order.pathaoLastError ? (
                        <p className="max-w-xs text-xs text-red-600">{order.pathaoLastError}</p>
                      ) : null}
                    </div>
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
                        ? 8
                        : 7
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