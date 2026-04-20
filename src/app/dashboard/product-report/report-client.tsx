"use client";

import { useRouter } from "next/navigation";

type ProductReportRow = {
  sku: string;
  invoiceQty: number;
  totalQty: number;
  called: number;
  ready: number;
  noAnswer: number;
  phoneOff: number;
  stockOut: number;
  cancelled: number;
  pending: number;
  conversion: string;
};

type Filters = {
  from: string;
  to: string;
  q: string;
};

function summaryTotal(data: ProductReportRow[], key: keyof ProductReportRow) {
  return data.reduce((sum, row) => {
    const value = row[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

export default function ProductReportClient({
  data,
  filters,
}: {
  data: ProductReportRow[];
  filters: Filters;
}) {
  const router = useRouter();

  function handleFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const from = String(formData.get("from") || "").trim();
    const to = String(formData.get("to") || "").trim();
    const q = String(formData.get("q") || "").trim();

    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (q) query.set("q", q);

    router.push(`/dashboard/product-report?${query.toString()}`);
  }

  const totalInvoiceQty = summaryTotal(data, "invoiceQty");
  const totalQty = summaryTotal(data, "totalQty");
  const totalCalled = summaryTotal(data, "called");
  const totalReady = summaryTotal(data, "ready");
  const totalNoAnswer = summaryTotal(data, "noAnswer");
  const totalPhoneOff = summaryTotal(data, "phoneOff");
  const totalStockOut = summaryTotal(data, "stockOut");
  const totalCancelled = summaryTotal(data, "cancelled");
  const totalPending = summaryTotal(data, "pending");
  const overallConversion =
    totalCalled > 0 ? ((totalReady / totalCalled) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Product Report</h1>
        <p className="mt-1 text-sm text-slate-500">
          SKU-wise performance with invoice count, quantity and calling outcome.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form
          onSubmit={handleFilter}
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          <div className="space-y-2">
            <label
              htmlFor="from"
              className="text-sm font-medium text-slate-700"
            >
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
            <label htmlFor="q" className="text-sm font-medium text-slate-700">
              Product Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={filters.q}
              placeholder="Search SKU..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Filter
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Invoice Qty</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalInvoiceQty}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Product Qty</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalQty}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Called</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalCalled}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ready</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {totalReady}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Conversion</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {overallConversion}%
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SKU
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice Qty
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Qty
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Called
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ready
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No Answer
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Off
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock Out
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cancelled
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pending
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conversion %
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row.sku} className="border-b last:border-b-0">
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">
                    {row.sku}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.invoiceQty}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.totalQty}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.called}
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-semibold text-emerald-600">
                    {row.ready}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.noAnswer}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.phoneOff}
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-orange-600">
                    {row.stockOut}
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-red-600">
                    {row.cancelled}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-slate-700">
                    {row.pending}
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-semibold text-blue-600">
                    {row.conversion}%
                  </td>
                </tr>
              ))}

              {!data.length && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No product report data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">No Answer</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalNoAnswer}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Phone Off</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalPhoneOff}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Stock Out</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            {totalStockOut}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cancelled</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {totalCancelled}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {totalPending}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">SKU Count</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data.length}
          </p>
        </div>
      </section>
    </div>
  );
}