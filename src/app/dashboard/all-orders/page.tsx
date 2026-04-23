import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteOrderButton from "./delete-order-button";

export const dynamic = "force-dynamic";

type AllOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

export default async function AllOrdersPage({
  searchParams,
}: AllOrdersPageProps) {
  const params = (await searchParams) || {};
  const q = (params.q || "").trim();

  const orders = await prisma.order.findMany({
    where: q
      ? {
          OR: [
            {
              invoiceId: {
                contains: q,
              },
            },
            {
              phone: {
                contains: q,
              },
            },
            {
              externalOrderId: {
                contains: q,
              },
            },
            {
              customerName: {
                contains: q,
              },
            },
          ],
        }
      : undefined,
    include: {
      source: true,
      page: true,
      integration: true,
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">All Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search and manage all orders from every source. Use this page to fix
          cancelled or incorrectly updated orders.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-3 space-y-2">
            <label htmlFor="q" className="text-sm font-medium text-slate-700">
              Search Order
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Search by invoice, phone, external order id, customer"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
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
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {order.invoiceId || "N/A"}
                      </p>
                      <p className="text-slate-500">
                        {order.externalOrderId || "N/A"}
                      </p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <p className="text-slate-500">{order.phone}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p>{order.source.name}</p>
                      <p className="text-slate-500">
                        {order.page?.name || "N/A"}
                      </p>
                    </div>
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
                    {formatMoney(Number(order.totalAmount))}
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
                    colSpan={7}
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
    </div>
  );
}