export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CancelledPage() {
  const { prisma } = await import("@/lib/prisma");
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: "CANCELLED",
    },
    include: {
      items: true,
      page: true,
      source: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Cancelled Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Orders marked as cancelled after print or manual correction.
        </p>
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
                  Items
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page / Source
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {order.invoiceId}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">{order.customerName}</p>
                      <p className="text-slate-500">{order.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <p key={item.id}>
                          {item.productSku} × {item.quantity}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p>{order.page?.name || "N/A"}</p>
                      <p className="text-slate-500">{order.source.name}</p>
                    </div>
                  </td>
                </tr>
              ))}

              {!orders.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    No cancelled orders found.
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