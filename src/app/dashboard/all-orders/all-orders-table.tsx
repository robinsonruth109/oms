"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import DeleteOrderButton from "./delete-order-button";
import { bulkDeleteOrdersAction } from "./actions";

type OrderRow = {
  id: string;
  invoiceId: string | null;
  externalOrderId: string | null;
  customerName: string;
  phone: string;
  orderStatus: string;
  totalAmount: number;
  sourceName: string;
  pageName: string;
  items: {
    id: string;
    productSku: string;
    quantity: number;
  }[];
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

export default function AllOrdersTable({ orders }: { orders: OrderRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const allSelected = orders.length > 0 && selectedIds.length === orders.length;

  function toggleAll() {
    setSelectedIds(allSelected ? [] : orders.map((order) => order.id));
  }

  function toggleOne(orderId: string) {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function handleBulkDelete() {
    if (!selectedIds.length) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} selected order(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    startTransition(async () => {
      const result = await bulkDeleteOrdersAction(selectedIds);

      setMessage(result.message);

      if (result.success) {
        setSelectedIds([]);
        window.location.reload();
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Order List</h2>
          <p className="text-sm text-slate-500">
            Selected: {selectedIds.length}
          </p>
        </div>

        <button
          type="button"
          disabled={!selectedIds.length || isPending}
          onClick={handleBulkDelete}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Bulk Delete"}
        </button>
      </div>

      {message ? (
        <div className="border-b bg-slate-50 px-5 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Source / Page
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Items
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-b-0">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleOne(order.id)}
                  />
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    {order.invoiceId || "N/A"}
                  </p>
                  <p className="text-slate-500">
                    {order.externalOrderId || "N/A"}
                  </p>
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    {order.customerName}
                  </p>
                  <p className="text-slate-500">{order.phone}</p>
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <p>{order.sourceName}</p>
                  <p className="text-slate-500">{order.pageName}</p>
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <div className="space-y-1">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item.id}>
                        {item.productSku} × {item.quantity}
                      </p>
                    ))}

                    {order.items.length > 2 ? (
                      <p className="text-slate-400">
                        +{order.items.length - 2} more
                      </p>
                    ) : null}
                  </div>
                </td>

                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {order.orderStatus}
                </td>

                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  {formatMoney(order.totalAmount)}
                </td>

                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/all-orders/${order.id}`}
                      className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View / Update
                    </Link>

                    <DeleteOrderButton orderId={order.id} />
                  </div>
                </td>
              </tr>
            ))}

            {!orders.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}