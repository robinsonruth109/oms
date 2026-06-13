"use client";

import { Fragment, useState } from "react";

type StatusBucket = {
  totalInvoice: number;
  ready: number;
  phoneOff: number;
  noAnswer: number;
  cancel: number;
  pending: number;
  stockOut: number;
};

type Row = {
  parentCode: string;
  parentName: string;
  sourceName: string;
  skuRows: ({
    sku: string;
    productName: string;
  } & StatusBucket)[];
} & StatusBucket;

type Source = {
  id: string;
  name: string;
  type: string;
};

export default function DailySourceStatusClient({
  rows,
  sources,
  filters,
  totals,
}: {
  rows: Row[];
  sources: Source[];
  filters: {
    from: string;
    to: string;
    sourceId: string;
  };
  totals: StatusBucket;
}) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setOpenRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Daily Source Status Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Parent-code wise daily order status. Click parent code to see SKU wise result.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="from" className="text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="to" className="text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={filters.to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="sourceId"
              className="text-sm font-medium text-slate-700"
            >
              Source
            </label>
            <select
              id="sourceId"
              name="sourceId"
              defaultValue={filters.sourceId}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-7">
        <Summary title="Total" value={totals.totalInvoice} />
        <Summary title="Ready" value={totals.ready} green />
        <Summary title="Phone Off" value={totals.phoneOff} />
        <Summary title="No Answer" value={totals.noAnswer} />
        <Summary title="Cancel" value={totals.cancel} red />
        <Summary title="Pending" value={totals.pending} amber />
        <Summary title="Stock Out" value={totals.stockOut} purple />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Parent Code Wise Report
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Product Parent Code</Th>
                <Th>Source</Th>
                <Th>Total Invoice</Th>
                <Th>Ready</Th>
                <Th>Phone Off</Th>
                <Th>No Answer</Th>
                <Th>Cancel</Th>
                <Th>Pending</Th>
                <Th>Stock Out</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const key = `${row.sourceName}-${row.parentCode}`;
                const isOpen = Boolean(openRows[key]);

                return (
                  <Fragment key={key}>
                    <tr className="border-b bg-white">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="text-left hover:underline"
                        >
                          {isOpen ? "▼" : "▶"} {row.parentCode}
                        </button>
                        <p className="mt-1 text-xs font-normal text-slate-500">
                          {row.parentName}
                        </p>
                      </td>

                      <Td>{row.sourceName}</Td>
                      <Td center>{row.totalInvoice}</Td>
                      <Td center green>{row.ready}</Td>
                      <Td center>{row.phoneOff}</Td>
                      <Td center>{row.noAnswer}</Td>
                      <Td center red>{row.cancel}</Td>
                      <Td center amber>{row.pending}</Td>
                      <Td center purple>{row.stockOut}</Td>
                    </tr>

                    {isOpen &&
                      row.skuRows.map((sku) => (
                        <tr
                          key={`${key}-${sku.sku}`}
                          className="border-b bg-slate-50"
                        >
                          <td className="px-10 py-3 text-sm text-slate-700">
                            <p className="font-medium">{sku.sku}</p>
                            <p className="text-xs text-slate-500">
                              {sku.productName}
                            </p>
                          </td>
                          <Td>{row.sourceName}</Td>
                          <Td center>{sku.totalInvoice}</Td>
                          <Td center green>{sku.ready}</Td>
                          <Td center>{sku.phoneOff}</Td>
                          <Td center>{sku.noAnswer}</Td>
                          <Td center red>{sku.cancel}</Td>
                          <Td center amber>{sku.pending}</Td>
                          <Td center purple>{sku.stockOut}</Td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No data found for this filter.
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

function Summary({
  title,
  value,
  green,
  red,
  amber,
  purple,
}: {
  title: string;
  value: number;
  green?: boolean;
  red?: boolean;
  amber?: boolean;
  purple?: boolean;
}) {
  const color = green
    ? "text-emerald-600"
    : red
      ? "text-red-600"
      : amber
        ? "text-amber-600"
        : purple
          ? "text-purple-600"
          : "text-slate-900";

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({
  children,
  center,
  green,
  red,
  amber,
  purple,
}: {
  children: React.ReactNode;
  center?: boolean;
  green?: boolean;
  red?: boolean;
  amber?: boolean;
  purple?: boolean;
}) {
  const color = green
    ? "text-emerald-600 font-semibold"
    : red
      ? "text-red-600 font-semibold"
      : amber
        ? "text-amber-600 font-semibold"
        : purple
          ? "text-purple-600 font-semibold"
          : "text-slate-700";

  return (
    <td
      className={`px-5 py-4 text-sm ${center ? "text-center" : "text-left"} ${color}`}
    >
      {children}
    </td>
  );
}