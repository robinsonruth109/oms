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
    from?: string;
    to?: string;
    source?: string;
    courier?: string;
  }>;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function taka(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(order: {
  pathaoOrderStatus: string | null;
  pathaoOrderStatusSlug: string | null;
}) {
  return (
    String(order.pathaoOrderStatus || "").trim() ||
    String(order.pathaoOrderStatusSlug || "").trim() ||
    "Awaiting Status Sync"
  );
}

function statusCardClass(label: string) {
  const value = label.toLowerCase();

  if (value.includes("deliver")) {
    return {
      card: "border-emerald-100 bg-emerald-50",
      label: "text-emerald-700",
      value: "text-emerald-800",
    };
  }

  if (value.includes("return") || value.includes("cancel")) {
    return {
      card: "border-rose-100 bg-rose-50",
      label: "text-rose-700",
      value: "text-rose-800",
    };
  }

  if (
    value.includes("hub") ||
    value.includes("transit") ||
    value.includes("pickup") ||
    value.includes("sorting")
  ) {
    return {
      card: "border-blue-100 bg-blue-50",
      label: "text-blue-700",
      value: "text-blue-800",
    };
  }

  if (value.includes("pending") || value.includes("await")) {
    return {
      card: "border-amber-100 bg-amber-50",
      label: "text-amber-700",
      value: "text-amber-800",
    };
  }

  return {
    card: "border-violet-100 bg-violet-50",
    label: "text-violet-700",
    value: "text-violet-800",
  };
}

export default async function PathaoDeliveryReportPage({
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;

  if (from > to) {
    [from, to] = [to, from];
  }

  const sourceId = String(params.source || "").trim();
  const courierId = String(params.courier || "").trim();

  const { prisma } = await import("@/lib/prisma");

  const [sources, couriers, orders] = await Promise.all([
    prisma.orderSource.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.courier.findMany({
      where: {
        status: true,
        pathaoEnabled: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.order.findMany({
      where: {
        readyToShipAt: {
          gte: bangladeshDateStartUtc(from),
          lte: bangladeshDateEndUtc(to),
        },
        pathaoConsignmentId: { not: null },
        ...(sourceId ? { sourceId } : {}),
        ...(courierId ? { pathaoCourierId: courierId } : {}),
      },
      select: {
        id: true,
        invoiceId: true,
        orderId: true,
        externalOrderId: true,
        readyToShipAt: true,
        totalAmount: true,
        deliveryCharge: true,
        pathaoDeliveryFee: true,
        pathaoConsignmentId: true,
        pathaoOrderStatus: true,
        pathaoOrderStatusSlug: true,
        source: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        pathaoCourier: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productSku: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ readyToShipAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const statusCounts = Array.from(
    orders
      .reduce((map, order) => {
        const label = statusLabel(order);
        map.set(label, (map.get(label) || 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const totalAmount = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0
  );
  const totalDeliveryCharge = orders.reduce(
    (sum, order) => sum + Number(order.deliveryCharge || 0),
    0
  );
  const totalPathaoFee = orders.reduce(
    (sum, order) => sum + Number(order.pathaoDeliveryFee || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Pathao Delivery Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Delivery status and product report by Ready to Ship date, Source and Pathao courier.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Source</span>
            <select
              name="source"
              defaultValue={sourceId}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Courier</span>
            <select
              name="courier"
              defaultValue={courierId}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="">All Pathao Couriers</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-700">Pathao Orders</p>
          <p className="mt-2 text-3xl font-bold text-sky-900">{orders.length}</p>
          <p className="mt-1 text-xs text-sky-600">
            Consignment-created orders in selected filter
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-indigo-700">Order Amount</p>
          <p className="mt-2 text-2xl font-bold text-indigo-900">
            {taka(totalAmount)}
          </p>
          <p className="mt-1 text-xs text-indigo-600">OMS total amount</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-700">Delivery Charge</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {taka(totalDeliveryCharge)}
          </p>
          <p className="mt-1 text-xs text-amber-600">Customer delivery charge</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Pathao Fee</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {taka(totalPathaoFee)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">Synced Pathao delivery fee</p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Delivery Status Summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live Pathao status-wise quantity for the selected report range.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statusCounts.map((status) => {
            const colors = statusCardClass(status.label);
            return (
              <div
                key={status.label}
                className={`rounded-2xl border p-4 ${colors.card}`}
              >
                <p className={`text-sm font-medium ${colors.label}`}>
                  {status.label}
                </p>
                <p className={`mt-2 text-3xl font-bold ${colors.value}`}>
                  {status.count}
                </p>
              </div>
            );
          })}

          {!statusCounts.length ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              No Pathao delivery status found for the selected filters.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Delivery List
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} Pathao order(s) · {from} to {to}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Courier</th>
                <th className="px-5 py-3">RTS Date</th>
                <th className="px-5 py-3">Pathao Status</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Delivery Charge</th>
                <th className="px-5 py-3 text-right">Pathao Fee</th>
                <th className="px-5 py-3">Consignment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t align-top">
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {order.invoiceId ||
                      order.orderId ||
                      order.externalOrderId ||
                      order.id}
                  </td>

                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id}>
                          <span className="font-medium text-slate-800">
                            {item.productName}
                          </span>
                          <span className="ml-1 text-xs text-slate-500">
                            ({item.productSku}) × {item.quantity}
                          </span>
                        </div>
                      ))}
                      {!order.items.length ? (
                        <span className="text-slate-400">No product item</span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800">{order.source.name}</p>
                    <p className="text-xs text-slate-400">{order.source.type}</p>
                  </td>

                  <td className="px-5 py-4">
                    {order.pathaoCourier?.name || "N/A"}
                  </td>

                  <td className="px-5 py-4">
                    {formatBangladeshDate(order.readyToShipAt)}
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {statusLabel(order)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right font-semibold">
                    {taka(order.totalAmount)}
                  </td>

                  <td className="px-5 py-4 text-right font-semibold text-amber-700">
                    {taka(order.deliveryCharge)}
                  </td>

                  <td className="px-5 py-4 text-right text-emerald-700">
                    {order.pathaoDeliveryFee == null
                      ? "—"
                      : taka(order.pathaoDeliveryFee)}
                  </td>

                  <td className="px-5 py-4">
                    <a
                      href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(
                        order.pathaoConsignmentId || ""
                      )}?isShowingActive=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs font-medium text-blue-600 hover:underline"
                    >
                      {order.pathaoConsignmentId}
                    </a>
                  </td>
                </tr>
              ))}

              {!orders.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No Pathao orders found for this date range and filter.
                  </td>
                </tr>
              ) : null}
            </tbody>

            {orders.length ? (
              <tfoot className="border-t-2 bg-slate-50">
                <tr>
                  <td colSpan={6} className="px-5 py-4 text-right font-bold text-slate-900">
                    Total
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900">
                    {taka(totalAmount)}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-amber-700">
                    {taka(totalDeliveryCharge)}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-emerald-700">
                    {taka(totalPathaoFee)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}
