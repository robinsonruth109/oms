import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
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

const PRIMARY_STATUS_COLUMNS = [
  "order.paid",
  "order.return-in-transit",
  "In Transit",
  "At the Sorting HUB",
  "On Hold",
  "Delivered",
  "Assigned for Delivery",
  "Received at Last Mile HUB",
  "order.return-id-created",
  "order.returned-to-merchant",
  "order.updated",
  "Pickup Failed",
] as const;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function taka(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function canonicalPathaoStatus(order: {
  pathaoOrderStatus: string | null;
  pathaoOrderStatusSlug: string | null;
}) {
  const aliases = new Map<string, string>([
    ["order.paid", "order.paid"],
    ["paid", "order.paid"],

    ["order.return-in-transit", "order.return-in-transit"],
    ["return in transit", "order.return-in-transit"],
    ["return-in-transit", "order.return-in-transit"],

    ["in transit", "In Transit"],
    ["order.in-transit", "In Transit"],

    ["at the sorting hub", "At the Sorting HUB"],
    ["order.at-the-sorting-hub", "At the Sorting HUB"],

    ["on hold", "On Hold"],
    ["order.on-hold", "On Hold"],

    ["delivered", "Delivered"],
    ["order.delivered", "Delivered"],

    ["assigned for delivery", "Assigned for Delivery"],
    ["order.assigned-for-delivery", "Assigned for Delivery"],

    ["received at last mile hub", "Received at Last Mile HUB"],
    ["order.received-at-last-mile-hub", "Received at Last Mile HUB"],

    ["order.return-id-created", "order.return-id-created"],
    ["return id created", "order.return-id-created"],

    ["order.returned-to-merchant", "order.returned-to-merchant"],
    ["returned to merchant", "order.returned-to-merchant"],

    ["order.updated", "order.updated"],

    ["pickup failed", "Pickup Failed"],
    ["order.pickup-failed", "Pickup Failed"],
  ]);

  const candidates = [order.pathaoOrderStatus, order.pathaoOrderStatusSlug];

  for (const candidate of candidates) {
    const normalized = normalizeStatus(candidate);
    if (!normalized) continue;
    const alias = aliases.get(normalized);
    if (alias) return alias;
  }

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

  if (value.includes("hold") || value.includes("pending") || value.includes("await")) {
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
        totalAmount: true,
        deliveryCharge: true,
        pathaoDeliveryFee: true,
        pathaoOrderStatus: true,
        pathaoOrderStatusSlug: true,
        source: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        items: {
          select: {
            id: true,
            productSku: true,
            productName: true,
            quantity: true,
            product: {
              select: {
                sku: true,
                name: true,
                parent: {
                  select: {
                    sku: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ readyToShipAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const productStatusQuantity = new Map<string, number>();
  const extraStatuses = new Set<string>();

  type ProductReportRow = {
    key: string;
    parentCode: string;
    parentName: string;
    childSku: string;
    productName: string;
    sourceId: string;
    sourceName: string;
    sourceType: string;
    totalQty: number;
    statuses: Map<string, number>;
  };

  const productRowMap = new Map<string, ProductReportRow>();

  for (const order of orders) {
    const status = canonicalPathaoStatus(order);

    if (!PRIMARY_STATUS_COLUMNS.includes(status as (typeof PRIMARY_STATUS_COLUMNS)[number])) {
      extraStatuses.add(status);
    }

    for (const item of order.items) {
      const quantity = Math.max(0, Number(item.quantity || 0));
      if (!quantity) continue;

      productStatusQuantity.set(
        status,
        (productStatusQuantity.get(status) || 0) + quantity
      );

      const parentCode = item.product?.parent.sku || "UNLINKED";
      const parentName = item.product?.parent.name || "Product parent not linked";
      const childSku = item.product?.sku || item.productSku;
      const productName = item.product?.name || item.productName;
      const key = [parentCode, childSku, order.source.id].join("::");

      const row =
        productRowMap.get(key) ||
        {
          key,
          parentCode,
          parentName,
          childSku,
          productName,
          sourceId: order.source.id,
          sourceName: order.source.name,
          sourceType: order.source.type,
          totalQty: 0,
          statuses: new Map<string, number>(),
        };

      row.totalQty += quantity;
      row.statuses.set(status, (row.statuses.get(status) || 0) + quantity);
      productRowMap.set(key, row);
    }
  }

  const statusColumns = [
    ...PRIMARY_STATUS_COLUMNS,
    ...Array.from(extraStatuses).sort((a, b) => a.localeCompare(b)),
  ];

  const productRows = Array.from(productRowMap.values()).sort(
    (a, b) =>
      a.parentCode.localeCompare(b.parentCode) ||
      a.childSku.localeCompare(b.childSku) ||
      a.sourceName.localeCompare(b.sourceName)
  );

  const totalProductQty = productRows.reduce(
    (sum, row) => sum + row.totalQty,
    0
  );

  const statusCounts = statusColumns
    .map((label) => ({
      label,
      count: productStatusQuantity.get(label) || 0,
    }))
    .filter((row) => row.count > 0);

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
          Product quantity by Pathao delivery status, filtered by Ready to Ship date, Source and courier.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-700">Pathao Orders</p>
          <p className="mt-2 text-3xl font-bold text-sky-900">{orders.length}</p>
          <p className="mt-1 text-xs text-sky-600">Orders in selected filter</p>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-cyan-700">Product Qty</p>
          <p className="mt-2 text-3xl font-bold text-cyan-900">{totalProductQty}</p>
          <p className="mt-1 text-xs text-cyan-600">Total item quantity</p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-indigo-700">Order Amount</p>
          <p className="mt-2 text-2xl font-bold text-indigo-900">
            {taka(totalAmount)}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-700">Delivery Charge</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {taka(totalDeliveryCharge)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Pathao Fee</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {taka(totalPathaoFee)}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Quantity by Pathao Status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Each number is product/item quantity, not order count.
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
              No product quantity found for the selected filters.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Delivery Status Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Grouped by Parent Code, Child SKU and Source · {from} to {to}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            style={{ minWidth: `${760 + statusColumns.length * 145}px` }}
          >
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 min-w-[150px] bg-slate-50 px-4 py-3">
                  Parent Code
                </th>
                <th className="min-w-[170px] px-4 py-3">Child SKU</th>
                <th className="min-w-[260px] px-4 py-3">Product Name</th>
                <th className="min-w-[190px] px-4 py-3">Source</th>
                <th className="min-w-[90px] px-4 py-3 text-center">Total Qty</th>
                {statusColumns.map((status) => (
                  <th
                    key={status}
                    className="min-w-[145px] whitespace-normal px-3 py-3 text-center"
                  >
                    {status}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {productRows.map((row, index) => {
                const previous = index > 0 ? productRows[index - 1] : null;
                const firstForParent = previous?.parentCode !== row.parentCode;

                return (
                  <tr key={row.key} className="border-t align-top hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-4 py-4">
                      {firstForParent ? (
                        <>
                          <p className="font-bold text-slate-900">{row.parentCode}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.parentName}</p>
                        </>
                      ) : (
                        <span className="text-slate-300">↳</span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {row.childSku}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{row.productName}</p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{row.sourceName}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.sourceType}</p>
                    </td>

                    <td className="px-4 py-4 text-center text-lg font-bold text-slate-900">
                      {row.totalQty}
                    </td>

                    {statusColumns.map((status) => {
                      const qty = row.statuses.get(status) || 0;
                      return (
                        <td
                          key={status}
                          className={
                            "px-3 py-4 text-center font-semibold " +
                            (qty ? "text-slate-900" : "text-slate-300")
                          }
                        >
                          {qty}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {!productRows.length ? (
                <tr>
                  <td
                    colSpan={5 + statusColumns.length}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No product delivery data found for this date range and filter.
                  </td>
                </tr>
              ) : null}
            </tbody>

            {productRows.length ? (
              <tfoot className="border-t-2 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-900">
                    Total Product Qty
                  </td>
                  <td className="px-4 py-4 text-center text-lg font-bold text-slate-900">
                    {totalProductQty}
                  </td>
                  {statusColumns.map((status) => (
                    <td
                      key={status}
                      className="px-3 py-4 text-center font-bold text-slate-900"
                    >
                      {productStatusQuantity.get(status) || 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}
