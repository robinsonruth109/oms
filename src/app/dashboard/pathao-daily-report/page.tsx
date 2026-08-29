import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDate,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    date?: string;
    courier?: string;
  }>;
};

type ReportOrder = {
  id: string;
  invoiceId: string | null;
  orderId: string | null;
  externalOrderId: string | null;
  customerName: string;
  phone: string;
  courier: string | null;
  orderStatus: string;
  readyToShipAt: Date;
  createdAt: Date;
  invoiceDownloaded: boolean;
  csvDownloaded: boolean;
  pathaoConsignmentId: string | null;
  pathaoSubmissionStatus: string;
  pathaoOrderStatus: string | null;
  pathaoOrderStatusSlug: string | null;
};

function shortDateLabel(value: string) {
  const [, month, day] = value.split("-");
  return `${day}-${month}`;
}

function hasReachedReadyToShip(order: ReportOrder) {
  return (
    ["READY_TO_SHIP", "STOCK_OUT", "RETURNED", "PARTIAL_RETURN"].includes(order.orderStatus) ||
    order.invoiceDownloaded ||
    order.csvDownloaded ||
    order.pathaoSubmissionStatus !== "NOT_SUBMITTED"
  );
}

export default async function PathaoDailyReportPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const selectedDate = String(
    params.date || getBangladeshDateInputValue()
  ).trim();
  const selectedCourier = String(params.courier || "").trim();

  const couriers = await prisma.courier.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      pathaoEnabled: true,
      pathaoStoreId: true,
    },
  });

  const rawOrders = await prisma.order.findMany({
    where: {
      readyToShipAt: {
        gte: bangladeshDateStartUtc(selectedDate),
        lte: bangladeshDateEndUtc(selectedDate),
      },
      ...(selectedCourier ? { courier: selectedCourier } : {}),
    },
    select: {
      id: true,
      invoiceId: true,
      orderId: true,
      externalOrderId: true,
      customerName: true,
      phone: true,
      courier: true,
      orderStatus: true,
      readyToShipAt: true,
      createdAt: true,
      invoiceDownloaded: true,
      csvDownloaded: true,
      pathaoConsignmentId: true,
      pathaoSubmissionStatus: true,
      pathaoOrderStatus: true,
      pathaoOrderStatusSlug: true,
    },
    orderBy: [{ courier: "asc" }, { createdAt: "desc" }],
  });

  const orders = rawOrders.filter(hasReachedReadyToShip) as ReportOrder[];

  const stockOutActions = await prisma.postPrintActionLog.findMany({
    where: {
      actionType: "STOCK_OUT",
      createdAt: {
        gte: bangladeshDateStartUtc(selectedDate),
        lte: bangladeshDateEndUtc(selectedDate),
      },
      ...(selectedCourier
        ? {
            order: {
              courier: selectedCourier,
            },
          }
        : {}),
    },
    select: {
      orderId: true,
    },
  });

  const selectedDateIsToday =
    selectedDate === getBangladeshDateInputValue();

  const importDates = Array.from(
    new Set(orders.map((order) => getBangladeshDateInputValue(order.createdAt)))
  ).sort((a, b) => b.localeCompare(a));

  const previousImportDates = importDates.filter((date) => date !== selectedDate);

  const courierBySlug = new Map(
    couriers.map((courier) => [courier.slug, courier])
  );

  const reportRows = Array.from(
    orders.reduce((map, order) => {
      const slug = order.courier || "unassigned";
      const existing = map.get(slug) || {
        slug,
        name: courierBySlug.get(slug)?.name || order.courier || "Unassigned",
        pathaoEnabled: Boolean(courierBySlug.get(slug)?.pathaoEnabled),
        pathaoStoreId: courierBySlug.get(slug)?.pathaoStoreId || null,
        total: 0,
        stockOut: 0,
        verified: 0,
        missing: 0,
        importCounts: new Map<string, number>(),
      };

      existing.total += 1;
      if (order.orderStatus === "STOCK_OUT") existing.stockOut += 1;

      if (order.pathaoConsignmentId) existing.verified += 1;
      else existing.missing += 1;

      const importDate = getBangladeshDateInputValue(order.createdAt);
      existing.importCounts.set(
        importDate,
        (existing.importCounts.get(importDate) || 0) + 1
      );

      map.set(slug, existing);
      return map;
    }, new Map<string, {
      slug: string;
      name: string;
      pathaoEnabled: boolean;
      pathaoStoreId: number | null;
      total: number;
      stockOut: number;
      verified: number;
      missing: number;
      importCounts: Map<string, number>;
    }>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const totalOrders = orders.length;
  const selectedMemoCount = orders.filter(
    (order) => getBangladeshDateInputValue(order.createdAt) === selectedDate
  ).length;
  const previousMemoCount = totalOrders - selectedMemoCount;
  const verifiedCount = orders.filter((order) => order.pathaoConsignmentId).length;
  const missingCount = totalOrders - verifiedCount;
  const stockOutCohortCount = orders.filter(
    (order) => order.orderStatus === "STOCK_OUT"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Pathao Daily Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ready-to-ship-date report with courier-wise memo age, stock-out and
          Pathao consignment verification.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Ready to Ship Date
            </span>
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Courier</span>
            <select
              name="courier"
              defaultValue={selectedCourier}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="">All Couriers</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.slug}>
                  {courier.name}
                </option>
              ))}
            </select>
          </label>

          <button className="self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Apply Filter
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Ready Memo Total</p>
          <p className="mt-2 text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">
            {selectedDateIsToday ? "Today Memo" : "Selected Date Memo"}
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {selectedMemoCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Previous Date Memo</p>
          <p className="mt-2 text-2xl font-bold">{previousMemoCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Stock Out in RTS Memo</p>
          <p className="mt-2 text-2xl font-bold text-violet-600">
            {stockOutCohortCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stockOutActions.length} stock-out action(s) performed on selected date
          </p>
        </div>
        <div className="rounded-2xl border bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-emerald-700">Pathao Verified</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {verifiedCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-red-50 p-4 shadow-sm">
          <p className="text-sm text-red-700">Missing Consignment ID</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{missingCount}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Courier Wise Memo Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Memo columns use the order import/create date. The page filter uses
            Ready to Ship Date.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Courier Name</th>
                <th className="whitespace-nowrap px-5 py-3">Total Memo</th>
                <th className="whitespace-nowrap px-5 py-3 text-blue-600">
                  {selectedDateIsToday ? "Today Memo" : "Selected Memo"} {shortDateLabel(selectedDate)}
                </th>
                {previousImportDates.map((date) => (
                  <th key={date} className="whitespace-nowrap px-5 py-3">
                    {shortDateLabel(date)} Memo
                  </th>
                ))}
                <th className="whitespace-nowrap px-5 py-3">Stock Out</th>
                <th className="whitespace-nowrap px-5 py-3 text-emerald-600">
                  Pathao Verified
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-red-600">
                  Missing CID
                </th>
                <th className="whitespace-nowrap px-5 py-3">Match %</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => (
                <tr key={row.slug} className="border-t">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.pathaoEnabled
                        ? `Pathao API${row.pathaoStoreId ? ` · Store ${row.pathaoStoreId}` : ""}`
                        : "Pathao API not enabled"}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold">{row.total}</td>
                  <td className="px-5 py-4 font-semibold text-blue-600">
                    {row.importCounts.get(selectedDate) || 0}
                  </td>
                  {previousImportDates.map((date) => (
                    <td key={date} className="px-5 py-4">
                      {row.importCounts.get(date) || 0}
                    </td>
                  ))}
                  <td className="px-5 py-4 font-semibold text-violet-600">
                    {row.stockOut}
                  </td>
                  <td className="px-5 py-4 font-semibold text-emerald-600">
                    {row.verified}
                  </td>
                  <td className="px-5 py-4 font-semibold text-red-600">
                    {row.missing}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {row.total
                      ? `${((row.verified / row.total) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                </tr>
              ))}
              {!reportRows.length ? (
                <tr>
                  <td
                    colSpan={8 + previousImportDates.length}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No ready-to-ship memo found for the selected date.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Pathao Verification Details
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            An order is verified in Pathao when OMS has a consignment ID.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Courier</th>
                <th className="px-5 py-3">Import Date</th>
                <th className="px-5 py-3">RTS Date</th>
                <th className="px-5 py-3">OMS Status</th>
                <th className="px-5 py-3">Consignment ID</th>
                <th className="px-5 py-3">Pathao Status</th>
                <th className="px-5 py-3">Verified</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t align-top">
                  <td className="px-5 py-4 font-semibold">
                    {order.invoiceId || order.orderId || order.externalOrderId || order.id}
                  </td>
                  <td className="px-5 py-4">
                    <p>{order.customerName}</p>
                    <p className="text-xs text-slate-500">{order.phone}</p>
                  </td>
                  <td className="px-5 py-4">
                    {courierBySlug.get(order.courier || "")?.name || order.courier || "N/A"}
                  </td>
                  <td className="px-5 py-4">{formatBangladeshDate(order.createdAt)}</td>
                  <td className="px-5 py-4">{formatBangladeshDate(order.readyToShipAt)}</td>
                  <td className="px-5 py-4">{order.orderStatus}</td>
                  <td className="px-5 py-4 font-mono text-xs">
                    {order.pathaoConsignmentId || "—"}
                  </td>
                  <td className="px-5 py-4">
                    {order.pathaoOrderStatus || order.pathaoOrderStatusSlug || order.pathaoSubmissionStatus}
                  </td>
                  <td className="px-5 py-4">
                    {order.pathaoConsignmentId ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {order.pathaoConsignmentId ? (
                      <a
                        href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(order.pathaoConsignmentId)}?isShowingActive=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                      >
                        View in Pathao
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Not available</span>
                    )}
                  </td>
                </tr>
              ))}
              {!orders.length ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-500">
                    No orders found.
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
