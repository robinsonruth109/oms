"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Loader2,
  MoveRight,
} from "lucide-react";
import {
  lookupReadyToShipOrdersByInvoiceIds,
  shiftReadyToShipOrders,
} from "./actions";

type OrderRow = {
  id: string;
  invoiceId: string | null;
  customerName: string;
  phone: string;
  courier: string | null;
  totalAmount: number;
  readyToShipDate: string;
  items?: {
    sku: string;
    name: string;
    quantity: number;
  }[];
};

type ShiftLog = {
  id: string;
  sourceDate: string | null;
  targetDate: string;
  method: string;
  totalOrders: number;
  uploadedFileName: string | null;
  performedByName: string;
  performedByRole: string;
  createdAt: string;
  invoicePreview: string[];
};

type Props = {
  sourceDate: string;
  selectedCourier: string;
  eligibleCount: number;
  courierMap: Record<string, string>;
  manualOrders: OrderRow[];
  shiftLogs: ShiftLog[];
};

type StatusMessage = {
  kind: "success" | "error" | "info";
  text: string;
} | null;

function addOneDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatBusinessDate(value: string | null) {
  if (!value) return "Multiple dates";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function methodLabel(method: string) {
  return method === "CSV_UPLOAD" ? "CSV Upload" : "Date Filter";
}

function StatusBox({ message }: { message: StatusMessage }) {
  if (!message) return null;

  const success = message.kind === "success";
  const error = message.kind === "error";

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{message.text}</span>
    </div>
  );
}

function OrderSelectionTable({
  orders,
  selectedIds,
  onSelectedIdsChange,
  courierMap,
  emptyText,
}: {
  orders: OrderRow[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  courierMap: Record<string, string>;
  emptyText: string;
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = orders.length > 0 && selectedIds.length === orders.length;

  function toggleAll() {
    onSelectedIdsChange(allSelected ? [] : orders.map((order) => order.id));
  }

  function toggleOne(orderId: string) {
    onSelectedIdsChange(
      selectedSet.has(orderId)
        ? selectedIds.filter((id) => id !== orderId)
        : [...selectedIds, orderId]
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all orders"
              />
            </th>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Courier</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Ready Date</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {orders.map((order) => (
            <tr key={order.id} className="align-top">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedSet.has(order.id)}
                  onChange={() => toggleOne(order.id)}
                  aria-label={`Select ${order.invoiceId || order.id}`}
                />
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {order.invoiceId || "N/A"}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">
                  {order.customerName}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {order.phone}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {order.courier
                  ? courierMap[order.courier] || order.courier
                  : "N/A"}
              </td>
              <td className="max-w-[340px] px-4 py-3 text-xs text-slate-600">
                {order.items?.length
                  ? order.items
                      .map(
                        (item) =>
                          `${item.sku || item.name || "Item"} × ${item.quantity}`
                      )
                      .join(", ")
                  : "—"}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">
                ৳{order.totalAmount.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {formatBusinessDate(order.readyToShipDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReadyDateShiftClient({
  sourceDate,
  selectedCourier,
  eligibleCount,
  courierMap,
  manualOrders,
  shiftLogs,
}: Props) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"manual" | "csv">("manual");

  const [manualSelectedIds, setManualSelectedIds] = useState<string[]>([]);
  const [manualTargetDate, setManualTargetDate] = useState(
    addOneDay(sourceDate)
  );
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState<StatusMessage>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvOrders, setCsvOrders] = useState<OrderRow[]>([]);
  const [csvSelectedIds, setCsvSelectedIds] = useState<string[]>([]);
  const [csvTargetDate, setCsvTargetDate] = useState(addOneDay(sourceDate));
  const [csvMissing, setCsvMissing] = useState<string[]>([]);
  const [csvIneligible, setCsvIneligible] = useState<
    { invoiceId: string; reason: string }[]
  >([]);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState<StatusMessage>(null);

  async function shiftManualOrders() {
    if (!manualSelectedIds.length) {
      setManualMessage({ kind: "error", text: "Select at least one order." });
      return;
    }

    if (!manualTargetDate) {
      setManualMessage({
        kind: "error",
        text: "Choose the new Ready to Ship date.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Shift ${manualSelectedIds.length} selected order(s) from ${formatBusinessDate(
        sourceDate
      )} to ${formatBusinessDate(manualTargetDate)}?`
    );

    if (!confirmed) return;

    setManualBusy(true);
    setManualMessage({ kind: "info", text: "Shifting selected orders..." });

    try {
      const result = await shiftReadyToShipOrders({
        orderIds: manualSelectedIds,
        targetDate: manualTargetDate,
        method: "DATE_FILTER",
      });

      setManualMessage({
        kind: result.success ? "success" : "error",
        text: result.message,
      });

      if (result.success) {
        setManualSelectedIds([]);
        router.refresh();
      }
    } finally {
      setManualBusy(false);
    }
  }

  async function previewCsv() {
    if (!csvFile) {
      setCsvMessage({ kind: "error", text: "Choose a CSV file first." });
      return;
    }

    setCsvBusy(true);
    setCsvMessage({ kind: "info", text: "Reading invoice IDs from column A..." });
    setCsvOrders([]);
    setCsvSelectedIds([]);
    setCsvMissing([]);
    setCsvIneligible([]);

    try {
      const text = await csvFile.text();
      const parsed = Papa.parse<string[]>(text, {
        skipEmptyLines: true,
      });

      if (parsed.errors.length) {
        setCsvMessage({
          kind: "error",
          text: parsed.errors[0]?.message || "The CSV file could not be read.",
        });
        return;
      }

      let invoiceIds = parsed.data
        .map((row) => String(row?.[0] || "").replace(/^\uFEFF/, "").trim())
        .filter(Boolean);

      const header = String(invoiceIds[0] || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");
      if (
        ["invoice", "invoiceid", "invoiceno", "invoicenumber"].includes(
          header
        )
      ) {
        invoiceIds = invoiceIds.slice(1);
      }

      invoiceIds = [...new Set(invoiceIds)];

      if (!invoiceIds.length) {
        setCsvMessage({
          kind: "error",
          text: "No invoice IDs were found in column A.",
        });
        return;
      }

      const result = await lookupReadyToShipOrdersByInvoiceIds(invoiceIds);

      setCsvOrders(result.orders);
      setCsvSelectedIds(result.orders.map((order) => order.id));
      setCsvMissing(result.missingInvoiceIds);
      setCsvIneligible(result.ineligible);
      setCsvMessage({
        kind: result.success ? "success" : "error",
        text: result.message,
      });
    } catch (error) {
      setCsvMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to process CSV file.",
      });
    } finally {
      setCsvBusy(false);
    }
  }

  async function shiftCsvOrders() {
    if (!csvSelectedIds.length) {
      setCsvMessage({
        kind: "error",
        text: "Select at least one matched order.",
      });
      return;
    }

    if (!csvTargetDate) {
      setCsvMessage({
        kind: "error",
        text: "Choose the new Ready to Ship date.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Shift ${csvSelectedIds.length} CSV-matched order(s) to ${formatBusinessDate(
        csvTargetDate
      )}?`
    );

    if (!confirmed) return;

    setCsvBusy(true);
    setCsvMessage({ kind: "info", text: "Shifting CSV-matched orders..." });

    try {
      const result = await shiftReadyToShipOrders({
        orderIds: csvSelectedIds,
        targetDate: csvTargetDate,
        method: "CSV_UPLOAD",
        uploadedFileName: csvFile?.name,
      });

      setCsvMessage({
        kind: result.success ? "success" : "error",
        text: result.message,
      });

      if (result.success) {
        const shifted = new Set(csvSelectedIds);
        setCsvOrders((current) =>
          current.filter((order) => !shifted.has(order.id))
        );
        setCsvSelectedIds([]);
        router.refresh();
      }
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Shift Orders
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Only READY_TO_SHIP orders with no invoice download are eligible.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveMode("manual")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeMode === "manual"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Date Filter
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("csv")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeMode === "csv"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                CSV Upload
              </button>
            </div>
          </div>
        </div>

        {activeMode === "manual" ? (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {eligibleCount} eligible order(s) on {formatBusinessDate(sourceDate)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Courier: {selectedCourier ? courierMap[selectedCourier] || selectedCourier : "All Couriers"}
                  {eligibleCount > manualOrders.length
                    ? ` · Showing first ${manualOrders.length} of ${eligibleCount}`
                    : ""}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Ready to Ship Date
                  </label>
                  <input
                    type="date"
                    value={manualTargetDate}
                    onChange={(event) => setManualTargetDate(event.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm sm:w-[190px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={shiftManualOrders}
                  disabled={manualBusy || !manualSelectedIds.length}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {manualBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoveRight className="h-4 w-4" />
                  )}
                  Shift {manualSelectedIds.length} Selected
                </button>
              </div>
            </div>

            <StatusBox message={manualMessage} />

            <OrderSelectionTable
              orders={manualOrders}
              selectedIds={manualSelectedIds}
              onSelectedIdsChange={setManualSelectedIds}
              courierMap={courierMap}
              emptyText="No non-invoiced Ready to Ship orders were found for this date/filter."
            />
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
              <div className="rounded-2xl border border-dashed p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">
                      Upload invoice IDs in column A
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      CSV may have a header such as Invoice ID. Only column A is
                      read. Eligible matched orders are selected automatically.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => {
                          setCsvFile(event.target.files?.[0] || null);
                          setCsvOrders([]);
                          setCsvSelectedIds([]);
                          setCsvMissing([]);
                          setCsvIneligible([]);
                          setCsvMessage(null);
                        }}
                        className="block w-full rounded-xl border bg-white px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={previewCsv}
                        disabled={csvBusy || !csvFile}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                      >
                        {csvBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                        Upload & Preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Ready to Ship Date
                  </label>
                  <input
                    type="date"
                    value={csvTargetDate}
                    onChange={(event) => setCsvTargetDate(event.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm sm:w-[190px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={shiftCsvOrders}
                  disabled={csvBusy || !csvSelectedIds.length}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {csvBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoveRight className="h-4 w-4" />
                  )}
                  Shift {csvSelectedIds.length} Selected
                </button>
              </div>
            </div>

            <StatusBox message={csvMessage} />

            {(csvMissing.length > 0 || csvIneligible.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {csvMissing.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-semibold">
                      {csvMissing.length} invoice ID(s) not found
                    </div>
                    <div className="mt-2 max-h-24 overflow-auto text-xs">
                      {csvMissing.join(", ")}
                    </div>
                  </div>
                ) : null}

                {csvIneligible.length > 0 ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <div className="font-semibold">
                      {csvIneligible.length} order(s) not eligible
                    </div>
                    <div className="mt-2 max-h-28 space-y-1 overflow-auto text-xs">
                      {csvIneligible.map((row) => (
                        <div key={`${row.invoiceId}-${row.reason}`}>
                          {row.invoiceId}: {row.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <OrderSelectionTable
              orders={csvOrders}
              selectedIds={csvSelectedIds}
              onSelectedIdsChange={setCsvSelectedIds}
              courierMap={courierMap}
              emptyText="Upload a CSV to preview eligible orders here."
            />
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b p-5 sm:p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <History className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Shift Log</h2>
            <p className="text-sm text-slate-500">
              Latest 50 Ready to Ship date changes with actor and exact Bangladesh time.
            </p>
          </div>
        </div>

        <div className="divide-y">
          {shiftLogs.length ? (
            shiftLogs.map((log) => {
              const shownInvoices = log.invoicePreview.join(", ");
              const remaining = Math.max(
                0,
                log.totalOrders - log.invoicePreview.length
              );

              return (
                <article key={log.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {log.totalOrders} order{log.totalOrders === 1 ? "" : "s"}{" "}
                        shifted from {formatBusinessDate(log.sourceDate)} to{" "}
                        {formatBusinessDate(log.targetDate)} by {log.performedByName}{" "}
                        at {log.createdAt}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          {methodLabel(log.method)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          {log.performedByRole}
                        </span>
                        {log.uploadedFileName ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                            {log.uploadedFileName}
                          </span>
                        ) : null}
                      </div>
                      {shownInvoices ? (
                        <p className="mt-3 text-xs text-slate-500">
                          Invoice IDs: {shownInvoices}
                          {remaining > 0 ? ` + ${remaining} more` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              No date-shift log exists yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
