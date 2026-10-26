"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarRange,
  History,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import {
  deleteMerchantPastHistory,
  saveMerchantOmsStartDate,
  saveMerchantPastHistory,
} from "./actions";

type Parent = {
  id: string;
  sku: string;
  name: string;
};

type Merchant = {
  id: string;
  name: string;
  omsAccountingStartDate: string;
  assignedParents: Parent[];
};

type HistoryRow = {
  id: string;
  merchantId: string;
  merchantName: string;
  parentId: string;
  parentSku: string;
  parentName: string;
  historyMonth: string;
  courierSendQty: number;
  returnReceivedQty: number;
  adsCostBdt: number;
  returnCost: number;
  discount: number;
  profit: number;
  note: string;
};

function monthNow() {
  return new Date().toISOString().slice(0, 7);
}

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-BD", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function MerchantPastHistoryClient({
  merchants,
  history,
}: {
  merchants: Merchant[];
  history: HistoryRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const [merchantId, setMerchantId] = useState(merchants[0]?.id || "");
  const selectedMerchant = merchants.find((m) => m.id === merchantId);

  const [borderDate, setBorderDate] = useState(
    selectedMerchant?.omsAccountingStartDate || ""
  );

  const [historyMonth, setHistoryMonth] = useState(monthNow());
  const [parentId, setParentId] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const [courierSendQty, setCourierSendQty] = useState(0);
  const [returnReceivedQty, setReturnReceivedQty] = useState(0);
  const [adsCostBdt, setAdsCostBdt] = useState(0);
  const [returnCost, setReturnCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [profit, setProfit] = useState(0);
  const [note, setNote] = useState("");

  const [filterMerchantId, setFilterMerchantId] = useState(merchantId);
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [search, setSearch] = useState("");

  const assignedParents = useMemo(() => {
    const q = parentQuery.trim().toLowerCase();
    return (selectedMerchant?.assignedParents || []).filter((parent) =>
      !q
        ? true
        : (parent.sku + " " + parent.name).toLowerCase().includes(q)
    );
  }, [selectedMerchant, parentQuery]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((row) => {
      if (filterMerchantId && row.merchantId !== filterMerchantId) return false;
      if (fromMonth && row.historyMonth < fromMonth) return false;
      if (toMonth && row.historyMonth > toMonth) return false;
      if (
        q &&
        !(row.parentSku + " " + row.parentName + " " + row.merchantName)
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [history, filterMerchantId, fromMonth, toMonth, search]);

  const totals = useMemo(
    () =>
      filteredHistory.reduce(
        (sum, row) => ({
          courierSendQty: sum.courierSendQty + row.courierSendQty,
          returnReceivedQty: sum.returnReceivedQty + row.returnReceivedQty,
          adsCostBdt: sum.adsCostBdt + row.adsCostBdt,
          returnCost: sum.returnCost + row.returnCost,
          discount: sum.discount + row.discount,
          profit: sum.profit + row.profit,
        }),
        {
          courierSendQty: 0,
          returnReceivedQty: 0,
          adsCostBdt: 0,
          returnCost: 0,
          discount: 0,
          profit: 0,
        }
      ),
    [filteredHistory]
  );

  function chooseMerchant(nextId: string) {
    setMerchantId(nextId);
    const merchant = merchants.find((m) => m.id === nextId);
    setBorderDate(merchant?.omsAccountingStartDate || "");
    setParentId("");
    setParentQuery("");
  }

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarRange className="mt-0.5 h-5 w-5 text-amber-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-amber-950">
              OMS Accounting Border Date
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Before this date = manual Past History. From this date onward = live
              OMS accounting. Set this once for every Merchant.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_280px_auto]">
              <select
                value={merchantId}
                onChange={(event) => chooseMerchant(event.target.value)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select Merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={borderDate}
                onChange={(event) => setBorderDate(event.target.value)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={pending || !merchantId || !borderDate}
                onClick={() =>
                  run(() =>
                    saveMerchantOmsStartDate({
                      merchantId,
                      startDate: borderDate,
                    })
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Border Date
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-100 p-2.5">
            <History className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Add / Update Monthly Past History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              One row per Merchant + Parent Code + Month. Saving the same month and
              Parent Code updates the existing row.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Merchant</span>
            <select
              value={merchantId}
              onChange={(event) => chooseMerchant(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5"
            >
              <option value="">Select Merchant</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">History Month</span>
            <input
              type="month"
              value={historyMonth}
              onChange={(event) => setHistoryMonth(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>

          <div className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Assigned Parent Code</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={parentQuery}
                onChange={(event) => setParentQuery(event.target.value)}
                placeholder="Search Parent SKU or name"
                className="w-full rounded-xl border py-2.5 pl-9 pr-3"
              />
            </div>
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2.5"
            >
              <option value="">Select Parent SKU</option>
              {assignedParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.sku} — {parent.name}
                </option>
              ))}
            </select>
            {merchantId && !assignedParents.length ? (
              <p className="text-xs text-amber-700">
                No assigned Parent SKU found for this Merchant.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Courier Send", courierSendQty, setCourierSendQty],
            ["Return Received", returnReceivedQty, setReturnReceivedQty],
            ["Ads Cost (BDT)", adsCostBdt, setAdsCostBdt],
            ["Return Cost", returnCost, setReturnCost],
            ["Discount", discount, setDiscount],
            ["Profit", profit, setProfit],
          ].map(([label, value, setter]) => (
            <label key={String(label)} className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">{String(label)}</span>
              <input
                type="number"
                min={label === "Profit" ? undefined : 0}
                step={label === "Courier Send" || label === "Return Received" ? 1 : "0.01"}
                value={Number(value)}
                onChange={(event) =>
                  (setter as React.Dispatch<React.SetStateAction<number>>)(
                    Number(event.target.value || 0)
                  )
                }
                className="w-full rounded-xl border px-3 py-2.5"
              />
            </label>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note"
          className="mt-4 min-h-20 w-full rounded-xl border px-3 py-2.5 text-sm"
        />

        <button
          type="button"
          disabled={pending || !merchantId || !parentId || !historyMonth}
          onClick={() =>
            run(() =>
              saveMerchantPastHistory({
                merchantId,
                parentId,
                historyMonth,
                courierSendQty,
                returnReceivedQty,
                adsCostBdt,
                returnCost,
                discount,
                profit,
                note,
              })
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Past History
        </button>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold text-slate-950">Past History Records</h2>
          <p className="mt-1 text-sm text-slate-500">
            Filter by Merchant, month range, Parent SKU or product name.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <select
              value={filterMerchantId}
              onChange={(event) => setFilterMerchantId(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
            >
              <option value="">All Merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={fromMonth}
              onChange={(event) => setFromMonth(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              type="month"
              value={toMonth}
              onChange={(event) => setToMonth(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Parent SKU / name"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-3 border-b bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Courier Send", totals.courierSendQty.toLocaleString("en-BD")],
            ["Return Received", totals.returnReceivedQty.toLocaleString("en-BD")],
            ["Ads Cost", money(totals.adsCostBdt)],
            ["Return Cost", money(totals.returnCost)],
            ["Discount", money(totals.discount)],
            ["Profit", money(totals.profit)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Parent SKU</th>
                <th className="px-4 py-3 text-right">Courier Send</th>
                <th className="px-4 py-3 text-right">Return RCV</th>
                <th className="px-4 py-3 text-right">Ads Cost</th>
                <th className="px-4 py-3 text-right">Return Cost</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredHistory.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold">{monthLabel(row.historyMonth)}</td>
                  <td className="px-4 py-3">{row.merchantName}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{row.parentSku}</p>
                    <p className="text-xs text-slate-500">{row.parentName}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{row.courierSendQty}</td>
                  <td className="px-4 py-3 text-right">{row.returnReceivedQty}</td>
                  <td className="px-4 py-3 text-right">{money(row.adsCostBdt)}</td>
                  <td className="px-4 py-3 text-right">{money(row.returnCost)}</td>
                  <td className="px-4 py-3 text-right">{money(row.discount)}</td>
                  <td className={"px-4 py-3 text-right font-bold " + (row.profit < 0 ? "text-rose-700" : "text-emerald-700")}>
                    {money(row.profit)}
                  </td>
                  <td className="max-w-56 px-4 py-3 text-slate-500">{row.note || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Delete this past-history row?")) return;
                        run(() => deleteMerchantPastHistory(row.id));
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredHistory.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    No past-history records match this filter.
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
