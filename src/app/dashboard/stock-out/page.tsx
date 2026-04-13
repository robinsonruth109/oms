import { prisma } from "@/lib/prisma";
import RestoreButton from "./restore-button";

type StockOutRow = {
  orderId: string;
  orderItemId: string;
  invoiceId: string | null;
  customerName: string;
  phone: string;
  pageName: string;
  sourceName: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

export default async function StockOutPage() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: "STOCK_OUT",
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

  const rows: StockOutRow[] = orders.flatMap((order) =>
    order.items.map((item) => ({
      orderId: order.id,
      orderItemId: item.id,
      invoiceId: order.invoiceId,
      customerName: order.customerName,
      phone: order.phone,
      pageName: order.page?.name || "N/A",
      sourceName: order.source.name,
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    }))
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Stock Out Items</h1>
        <p className="mt-1 text-sm text-slate-500">
          Orders marked as stock out shown item-wise. Restore any order back to
          ready-to-ship when stock returns.
        </p>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  QTY
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unit Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Value
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page / Source
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.orderItemId} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.productName}
                      </p>
                      <p className="text-slate-500">{row.productSku}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {row.invoiceId || "N/A"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {row.quantity}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {formatMoney(row.unitPrice)}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {formatMoney(row.lineTotal)}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.customerName}
                      </p>
                      <p className="text-slate-500">{row.phone}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p>{row.pageName}</p>
                      <p className="text-slate-500">{row.sourceName}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <RestoreButton orderId={row.orderId} />
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No stock out items found.
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