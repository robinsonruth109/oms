"use client";

type PendingOrderItem = {
  id: string;
  productId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type PendingOrder = {
  id: string;
  orderId: string | null;
  invoiceId: string | null;
  externalOrderId: string | null;
  customerName: string;
  phone: string;
  address: string;
  subtotal: number;
  discount: number;
  advance: number;
  deliveryCharge: number;
  totalAmount: number;
  orderStatus: string;
  courier: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  source: {
    id: string;
    name: string;
    type: string;
  };
  integration: {
    id: string;
    name: string;
    slug: string;
    platform: string;
  } | null;
  items: PendingOrderItem[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function PendingOrdersTable({
  orders,
}: {
  orders: PendingOrder[];
}) {
  return (
    <div className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Pending Order Inbox
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          No actions here. Use the Calling Panel to edit, confirm, cancel or stock out.
        </p>
      </div>

      <div className="space-y-4 p-4 lg:hidden">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {order.customerName}
                </h3>
                <p className="text-sm text-slate-500">{order.phone}</p>
              </div>

              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {order.orderStatus}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Source</p>
                <p className="font-medium text-slate-800">{order.source.name}</p>
              </div>

              <div>
                <p className="text-slate-400">Platform</p>
                <p className="font-medium text-slate-800">
                  {order.integration?.platform || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Website Invoice</p>
                <p className="font-medium text-slate-800">
                  {order.invoiceId || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-slate-400">External Order ID</p>
                <p className="font-medium text-slate-800">
                  {order.externalOrderId || "N/A"}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-slate-400">Address</p>
                <p className="font-medium text-slate-800">{order.address}</p>
              </div>

              <div className="col-span-2">
                <p className="text-slate-400">Items</p>
                <div className="space-y-1">
                  {order.items.map((item) => (
                    <p key={item.id} className="font-medium text-slate-800">
                      {item.productSku ? `${item.productSku} - ` : ""}
                      {item.productName} × {item.quantity}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-400">Total</p>
                <p className="font-medium text-slate-800">
                  ৳ {order.totalAmount.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Imported At</p>
                <p className="font-medium text-slate-800">
                  {formatDate(order.createdAt)}
                </p>
              </div>

              {order.note ? (
                <div className="col-span-2">
                  <p className="text-slate-400">Note</p>
                  <p className="font-medium text-slate-800">{order.note}</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {!orders.length && (
          <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
            No pending orders found.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Source
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Items
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Imported At
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-b-0 align-top">
                <td className="px-6 py-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">{order.source.name}</p>
                    <p className="text-slate-500">
                      {order.integration?.platform || "N/A"}
                    </p>
                    <p className="text-slate-400">
                      {order.externalOrderId || "N/A"}
                    </p>
                  </div>
                </td>

                <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                  {order.invoiceId || "N/A"}
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">
                      {order.customerName}
                    </p>
                    <p className="text-slate-500">{order.phone}</p>
                  </div>
                </td>

                <td className="px-6 py-4 text-sm text-slate-700 max-w-[260px]">
                  {order.address}
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <p key={item.id}>
                        {item.productSku ? `${item.productSku} - ` : ""}
                        {item.productName} × {item.quantity}
                      </p>
                    ))}
                  </div>
                </td>

                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  <div>
                    <p>৳ {order.totalAmount.toFixed(2)}</p>
                    {(order.discount > 0 || order.deliveryCharge > 0) && (
                      <p className="text-slate-500">
                        Disc: ৳ {order.discount.toFixed(2)} | Del: ৳{" "}
                        {order.deliveryCharge.toFixed(2)}
                      </p>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 text-sm text-slate-700">
                  {formatDate(order.createdAt)}
                </td>

                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {order.orderStatus}
                  </span>
                </td>
              </tr>
            ))}

            {!orders.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No pending orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}