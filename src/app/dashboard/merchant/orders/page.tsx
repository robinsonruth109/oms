import Link from "next/link";

import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  formatTaka,
  requireMerchantContext,
  validDate,
} from "@/lib/merchant-portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

export default async function MerchantOrdersPage({ searchParams }: Props) {
  const { merchant } = await requireMerchantContext();
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);

  const orders = await prisma.order.findMany({
    where: {
      calledAt: { gte: start, lte: end },
      orderStatus: {
        notIn: [
          "PENDING_CONFIRMATION",
          "NO_ANSWER",
          "PHONE_OFF",
          "DOUBLE_ORDER",
        ],
      },
      items: {
        some: {
          product: {
            parent: { merchantId: merchant.id },
          },
        },
      },
    },
    orderBy: { calledAt: "desc" },
    take: 500,
    select: {
      id: true,
      invoiceId: true,
      orderId: true,
      calledAt: true,
      orderStatus: true,
      courier: true,
      pathaoOrderStatus: true,
      pathaoOrderStatusSlug: true,
      pathaoConsignmentId: true,
      source: { select: { name: true } },
      items: {
        where: {
          product: {
            parent: { merchantId: merchant.id },
          },
        },
        select: {
          productSku: true,
          productName: true,
          quantity: true,
          lineTotal: true,
          product: {
            select: {
              parent: { select: { sku: true } },
            },
          },
        },
      },
    },
  });

  const totalItems = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + Math.max(0, Number(item.quantity || 0)),
        0
      ),
    0
  );
  const merchandise = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + Number(item.lineTotal || 0),
        0
      ),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Merchant Orders
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Confirmed calling-agent orders containing {merchant.name} products.
              Only your line items are shown.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <input
                name="from"
                type="date"
                defaultValue={from}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                name="to"
                type="date"
                defaultValue={to}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Confirmed Invoices" value={String(orders.length)} />
          <Stat label="Product Qty" value={totalItems.toLocaleString("en-BD")} />
          <Stat label="Merchant Line Value" value={formatTaka(merchandise)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Invoice</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">Merchant Products</th>
                <th className="px-5 py-4 text-right">Qty</th>
                <th className="px-5 py-4 text-right">Line Value</th>
                <th className="px-5 py-4">OMS Status</th>
                <th className="px-5 py-4">Courier / Pathao</th>
                <th className="px-5 py-4">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const qty = order.items.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                );
                const value = order.items.reduce(
                  (sum, item) => sum + Number(item.lineTotal || 0),
                  0
                );

                return (
                  <tr key={order.id} className="border-t align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950">
                        {order.invoiceId || order.orderId || order.id}
                      </p>
                      {order.pathaoConsignmentId ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {order.pathaoConsignmentId}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{order.source.name}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <p key={item.productSku} className="text-xs">
                            <strong>{item.productSku}</strong> × {item.quantity}
                            <span className="ml-1 text-slate-400">
                              ({item.product?.parent.sku || "Parent"})
                            </span>
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{qty}</td>
                    <td className="px-5 py-4 text-right">{formatTaka(value)}</td>
                    <td className="px-5 py-4">{order.orderStatus}</td>
                    <td className="px-5 py-4">
                      <p>{order.courier || "—"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.pathaoOrderStatus ||
                          order.pathaoOrderStatusSlug ||
                          "Not submitted"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {order.calledAt
                        ? order.calledAt.toLocaleString("en-BD")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {!orders.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No confirmed Merchant orders in this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Orders appear after a calling agent has confirmed them into an operational
        status. Mixed invoices are attributed by Merchant-owned line items rather
        than duplicating the complete invoice value.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
