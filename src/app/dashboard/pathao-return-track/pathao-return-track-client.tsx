"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackageCheck,
  ScanLine,
  Undo2,
} from "lucide-react";
import {
  processSelectedPathaoReturnAction,
  scanPathaoReturnAction,
  type ReturnLookupPayload,
  type ScanReturnResult,
} from "./actions";

type DailyRow = {
  id: string;
  returnConsignmentId: string;
  outboundConsignmentId: string | null;
  invoiceId: string;
  customerName: string;
  phone: string;
  omsStatus: string;
  previousOmsStatus: string;
  pathaoStatus: string | null;
  pathaoStatusSlug: string | null;
  courierName: string;
  returnType: string;
  totalRestoredQty: number;
  processedBy: string;
  processedAt: string;
  items: { sku: string; name: string; quantity: number }[];
};

type Props = {
  filterDate: string;
  rows: DailyRow[];
  summary: {
    totalReturns: number;
    fullReturns: number;
    partialReturns: number;
    restoredQty: number;
  };
};

type Notice = {
  kind: "success" | "error" | "warning" | "info";
  text: string;
} | null;

function statusClass(status: string) {
  if (status === "RETURNED") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL_RETURN") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function returnTypeClass(type: string) {
  return type === "FULL"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-800";
}

export default function PathaoReturnTrackClient({ filterDate, rows, summary }: Props) {
  const router = useRouter();
  const scanRef = useRef<HTMLInputElement>(null);
  const [consignmentId, setConsignmentId] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [lookup, setLookup] = useState<ReturnLookupPayload | null>(null);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!lookup && !isPending) {
      scanRef.current?.focus();
    }
  }, [lookup, isPending]);

  const selectedTotal = useMemo(
    () => Object.values(selectedQty).reduce((sum, qty) => sum + Math.max(0, Number(qty || 0)), 0),
    [selectedQty]
  );

  function refocusScanner() {
    window.setTimeout(() => scanRef.current?.focus(), 60);
  }

  function clearForNextScan() {
    setConsignmentId("");
    setLookup(null);
    setSelectedQty({});
    refocusScanner();
  }

  function handleResult(result: ScanReturnResult) {
    if (result.action === "NEEDS_ITEM_SELECTION") {
      setLookup(result.lookup);
      setSelectedQty(
        Object.fromEntries(result.lookup.order.items.map((item) => [item.orderItemId, 0]))
      );
      setNotice({ kind: "warning", text: result.message });
      return;
    }

    if (result.action === "PROCESSED") {
      setNotice({ kind: "success", text: result.message });
      clearForNextScan();
      router.refresh();
      return;
    }

    setNotice({
      kind: result.action === "ALREADY_PROCESSED" || result.action === "ALREADY_RETURNED" ? "warning" : "error",
      text: result.message,
    });
    clearForNextScan();
  }

  function submitScan(event: FormEvent) {
    event.preventDefault();
    if (lookup || isPending) return;

    const clean = consignmentId.trim();
    if (!clean) {
      setNotice({ kind: "error", text: "Scan or enter a Pathao return consignment ID." });
      refocusScanner();
      return;
    }

    setNotice({ kind: "info", text: "Checking all active Pathao courier accounts..." });

    startTransition(async () => {
      const result = await scanPathaoReturnAction(clean);
      handleResult(result);
    });
  }

  function setQty(orderItemId: string, value: number, max: number) {
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.trunc(value))) : 0;
    setSelectedQty((current) => ({ ...current, [orderItemId]: safe }));
  }

  function selectAllRemaining() {
    if (!lookup) return;
    setSelectedQty(
      Object.fromEntries(
        lookup.order.items.map((item) => [item.orderItemId, item.remainingQty])
      )
    );
  }

  function processSelection() {
    if (!lookup || isPending) return;

    const selectedItems = lookup.order.items
      .map((item) => ({
        orderItemId: item.orderItemId,
        returnedQty: Math.max(0, Math.trunc(Number(selectedQty[item.orderItemId] || 0))),
      }))
      .filter((item) => item.returnedQty > 0);

    if (!selectedItems.length) {
      setNotice({ kind: "error", text: "Select the returned product quantity first." });
      return;
    }

    setNotice({ kind: "info", text: "Updating OMS return status and restoring stock..." });

    startTransition(async () => {
      const result = await processSelectedPathaoReturnAction({
        consignmentId: lookup.consignmentId,
        pathaoCourierId: lookup.pathaoCourierId,
        orderId: lookup.order.id,
        selectedItems,
      });
      handleResult(result);
    });
  }

  const noticeStyles =
    notice?.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice?.kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : notice?.kind === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={submitScan} className="min-w-0 flex-1">
            <label htmlFor="returnConsignment" className="mb-2 block text-sm font-semibold text-slate-800">
              Scan Pathao Return Consignment ID
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={scanRef}
                  id="returnConsignment"
                  value={consignmentId}
                  onChange={(event) => setConsignmentId(event.target.value)}
                  disabled={Boolean(lookup) || isPending}
                  autoComplete="off"
                  inputMode="text"
                  placeholder="Scan barcode or type consignment ID, then Enter"
                  className="h-14 w-full rounded-2xl border bg-white pl-12 pr-4 text-lg font-semibold tracking-wide outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={Boolean(lookup) || isPending || !consignmentId.trim()}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-7 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending && !lookup ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Check Return
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              OMS checks every active Pathao courier account. A one-product × one-quantity return is processed immediately.
            </p>
          </form>
        </div>

        {notice ? (
          <div className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${noticeStyles}`}>
            {notice.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : notice.kind === "info" ? (
              <Loader2 className={`mt-0.5 h-5 w-5 shrink-0 ${isPending ? "animate-spin" : ""}`} />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        ) : null}
      </section>

      {lookup ? (
        <section className="rounded-3xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Select Returned Product / Quantity</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Invoice <span className="font-semibold">{lookup.order.invoiceId}</span> · Return CID {lookup.consignmentId} · {lookup.pathaoCourierName}
                </p>
              </div>
              <button
                type="button"
                onClick={selectAllRemaining}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800"
              >
                Return All Remaining
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Customer</p>
                <p className="mt-1 font-semibold text-slate-900">{lookup.order.customerName}</p>
                <p className="text-xs text-slate-500">{lookup.order.phone}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">OMS Status</p>
                <p className="mt-1 font-semibold text-slate-900">{lookup.order.orderStatus}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Pathao Status</p>
                <p className="mt-1 font-semibold text-slate-900">{lookup.pathaoStatus || lookup.pathaoStatusSlug || "N/A"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Selected Return Qty</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{selectedTotal}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Ordered</th>
                    <th className="px-4 py-3">Already Returned</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Return Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lookup.order.items.map((item) => (
                    <tr key={item.orderItemId}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{item.productName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.productSku}</p>
                      </td>
                      <td className="px-4 py-4 font-semibold">{item.orderedQty}</td>
                      <td className="px-4 py-4">{item.alreadyReturnedQty}</td>
                      <td className="px-4 py-4 font-semibold text-amber-700">{item.remainingQty}</td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min={0}
                          max={item.remainingQty}
                          step={1}
                          disabled={item.remainingQty <= 0 || isPending}
                          value={selectedQty[item.orderItemId] ?? 0}
                          onChange={(event) => setQty(item.orderItemId, Number(event.target.value), item.remainingQty)}
                          className="w-28 rounded-xl border px-3 py-2 text-center font-semibold outline-none disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setLookup(null);
                  setSelectedQty({});
                  setNotice({ kind: "info", text: "Return selection cancelled. Scan the next parcel." });
                  clearForNextScan();
                }}
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || selectedTotal <= 0}
                onClick={processSelection}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Process Return & Restore Stock
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Returns</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.totalReturns}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Full Return</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.fullReturns}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Partial Return</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.partialReturns}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Stock Restored</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.restoredQty} pcs</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <PackageCheck className="h-5 w-5" /> Daily Return List
            </h2>
            <p className="mt-1 text-sm text-slate-500">Processed Pathao returns for the selected Bangladesh date.</p>
          </div>
          <form className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Date</span>
              <input type="date" name="date" defaultValue={filterDate} className="rounded-xl border px-3 py-2.5 outline-none" />
            </label>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
              Filter
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Return CID</th>
                <th className="px-4 py-3">Outbound CID</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Returned Items</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">OMS Status</th>
                <th className="px-4 py-3">Pathao Status</th>
                <th className="px-4 py-3">Qty Restored</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Date / Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-4 font-bold text-slate-900">{row.invoiceId}</td>
                  <td className="px-4 py-4 font-mono text-xs font-semibold">{row.returnConsignmentId}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-600">{row.outboundConsignmentId || "—"}</td>
                  <td className="px-4 py-4">{row.courierName}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-800">{row.customerName}</p>
                    <p className="text-xs text-slate-500">{row.phone}</p>
                  </td>
                  <td className="max-w-[320px] px-4 py-4 text-xs text-slate-600">
                    {row.items.map((item) => `${item.sku} × ${item.quantity}`).join(", ")}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${returnTypeClass(row.returnType)}`}>{row.returnType}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(row.omsStatus)}`}>{row.omsStatus}</span>
                    <p className="mt-1 text-[11px] text-slate-400">from {row.previousOmsStatus}</p>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <p className="font-semibold text-slate-800">{row.pathaoStatus || "N/A"}</p>
                    {row.pathaoStatusSlug ? <p className="mt-1 text-slate-500">{row.pathaoStatusSlug}</p> : null}
                  </td>
                  <td className="px-4 py-4 font-bold">{row.totalRestoredQty}</td>
                  <td className="px-4 py-4">{row.processedBy}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">{row.processedAt}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={12} className="px-5 py-12 text-center text-slate-500">
                    No Pathao return was processed on this date.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
