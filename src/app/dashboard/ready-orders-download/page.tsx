export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    status?: string;
  }>;
};

function getLocalDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function formatStatus(status: string) {
  switch (status) {
    case "READY_TO_SHIP":
      return "Ready";
    case "NO_ANSWER":
      return "No Answer";
    case "PHONE_OFF":
      return "Phone Off";
    case "STOCK_OUT":
      return "Stock Out";
    case "CANCELLED":
      return "Cancelled";
    case "PENDING_CONFIRMATION":
      return "Pending";
    default:
      return status;
  }
}

export default async function ReadyOrdersDownloadPage({
  searchParams,
}: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const today = getLocalDateInputValue();

  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const status = (params.status || "READY_TO_SHIP").trim();

  const where: Record<string, any> = {
    updatedAt: {
      gte: startOfDay(from),
      lte: endOfDay(to),
    },
  };

  if (status && status !== "ALL") {
    where.orderStatus = status;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      source: true,
      page: true,
      items: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 500,
  });

  const downloadUrl = `/api/reports/order-list-csv?from=${encodeURIComponent(
    from
  )}&to=${encodeURIComponent(to)}&status=${encodeURIComponent(status)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Ready Orders Download
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Filter orders by date and status, then download the full CSV.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <label htmlFor="from" className="text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
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
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="status"
              className="text-sm font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="READY_TO_SHIP">Ready</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="PHONE_OFF">Phone Off</option>
              <option value="STOCK_OUT">Stock Out</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PENDING_CONFIRMATION">Pending</option>
              <option value="ALL">All Status</option>
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

          <div className="flex items-end">
            <a
              href={downloadUrl}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
            >
              Download CSV
            </a>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Order List ({orders.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source / Page
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Items
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {order.invoiceId || "N/A"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {order.customerName}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {order.phone}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p>{order.source.name}</p>
                      <p className="text-slate-500">{order.page?.name || "N/A"}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center text-sm text-slate-700">
                    {order.items.length}
                  </td>

                  <td className="px-6 py-4 text-center text-sm font-medium text-slate-800">
                    {formatStatus(order.orderStatus)}
                  </td>

                  <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                    {formatMoney(Number(order.totalAmount))}
                  </td>
                </tr>
              ))}

              {!orders.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No orders found for this filter.
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
