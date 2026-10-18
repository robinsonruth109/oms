"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, PackageCheck, Search, XCircle } from "lucide-react";

export type VerifiedStockWatchRow = {
  key: string;
  parentSku: string;
  sku: string;
  name: string;
  mode: string;
  quantity: number;
  unitsPerSale: string;
};

type View = "LOW" | "OUT" | "ALL";

export default function VerifiedStockWatch({
  rows,
}: {
  rows: VerifiedStockWatchRow[];
}) {
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(10);
  const [view, setView] = useState<View>("LOW");

  const normalizedThreshold = Math.max(1, Number(threshold || 10));

  const searchedRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (!q) return true;
      return (
        row.parentSku.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const stockOutRows = useMemo(
    () => searchedRows.filter((row) => row.quantity <= 0),
    [searchedRows]
  );

  const lowStockRows = useMemo(
    () =>
      searchedRows.filter(
        (row) => row.quantity > 0 && row.quantity <= normalizedThreshold
      ),
    [searchedRows, normalizedThreshold]
  );

  const visibleRows =
    view === "OUT"
      ? stockOutRows
      : view === "LOW"
        ? lowStockRows
        : searchedRows;

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-950">
                Verified Stock Watch
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Only physically verified stock owners are included. Search by Parent
              Code, Child SKU or product name and keep stock-out / low-stock items
              separate from the full verified list.
            </p>
          </div>

          <label className="block min-w-[180px]">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Low Stock Threshold
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={999999}
                value={threshold}
                onChange={(event) =>
                  setThreshold(Math.max(1, Number(event.target.value || 1)))
                }
                className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400"
              />
              <span className="text-xs text-slate-500">units</span>
            </div>
          </label>
        </div>
      </div>

      <div className="grid gap-3 border-b bg-slate-50/60 p-4 sm:grid-cols-3 sm:p-5">
        <button
          type="button"
          onClick={() => setView("ALL")}
          className={
            "rounded-2xl border p-4 text-left transition " +
            (view === "ALL"
              ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100"
              : "bg-white hover:bg-slate-50")
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Verified Products
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {searchedRows.length.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current verified inventory owners
          </p>
        </button>

        <button
          type="button"
          onClick={() => setView("OUT")}
          className={
            "rounded-2xl border p-4 text-left transition " +
            (view === "OUT"
              ? "border-rose-300 bg-rose-50 ring-2 ring-rose-100"
              : "border-rose-100 bg-white hover:bg-rose-50/50")
          }
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              Stock Out
            </p>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            {stockOutRows.length.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-rose-600">
            Verified stock at 0 or below
          </p>
        </button>

        <button
          type="button"
          onClick={() => setView("LOW")}
          className={
            "rounded-2xl border p-4 text-left transition " +
            (view === "LOW"
              ? "border-amber-300 bg-amber-50 ring-2 ring-amber-100"
              : "border-amber-100 bg-white hover:bg-amber-50/50")
          }
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Low Stock Warning
            </p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {lowStockRows.length.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            1–{normalizedThreshold.toLocaleString("en-BD")} verified units
          </p>
        </button>
      </div>

      <div className="border-b px-5 py-4 sm:px-6">
        <div className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Parent Code, SKU or product name..."
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing <strong>{visibleRows.length.toLocaleString("en-BD")}</strong>{" "}
          {view === "LOW"
            ? "low-stock"
            : view === "OUT"
              ? "stock-out"
              : "verified"}{" "}
          product{visibleRows.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Parent Code</th>
              <th className="px-5 py-3">SKU / Children</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Units / Sale</th>
              <th className="px-5 py-3 text-right">Verified Stock</th>
              <th className="px-5 py-3">Warning</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const out = row.quantity <= 0;
              const low = !out && row.quantity <= normalizedThreshold;

              return (
                <tr key={row.key} className="border-t align-top">
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {row.parentSku}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-slate-700">
                    {row.sku}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{row.name}</td>
                  <td className="px-5 py-4 text-slate-600">{row.mode}</td>
                  <td className="max-w-sm px-5 py-4 text-slate-600">
                    {row.unitsPerSale}
                  </td>
                  <td
                    className={
                      "px-5 py-4 text-right text-base font-bold " +
                      (out
                        ? "text-rose-700"
                        : low
                          ? "text-amber-800"
                          : "text-emerald-700")
                    }
                  >
                    {row.quantity.toLocaleString("en-BD")}
                  </td>
                  <td className="px-5 py-4">
                    {out ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                        STOCK OUT
                      </span>
                    ) : low ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        LOW STOCK
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        HEALTHY
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {!visibleRows.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-sm text-slate-500"
                >
                  {query.trim()
                    ? "No verified products match this search."
                    : view === "LOW"
                      ? "No verified low-stock products."
                      : view === "OUT"
                        ? "No verified stock-out products."
                        : "No verified products found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
