import { formatTaka, formatUsd, requireMerchantContext } from "@/lib/merchant-portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantPurchasesPage() {
  const { merchant } = await requireMerchantContext();

  const orders = await prisma.purchaseOrder.findMany({
    where: { merchantId: merchant.id },
    orderBy: { orderDate: "desc" },
    include: {
      payments: { orderBy: { paymentDate: "asc" } },
      receivedOrders: { orderBy: { receiveDate: "asc" } },
    },
  });

  const orderedQty = orders.reduce((sum, order) => sum + order.quantity, 0);
  const receivedQty = orders.reduce(
    (sum, order) =>
      sum +
      order.receivedOrders.reduce(
        (rowSum, row) => rowSum + Number(row.receivedQty || 0),
        0
      ),
    0
  );
  const paidBdt = orders.reduce(
    (sum, order) =>
      sum +
      order.payments.reduce(
        (rowSum, row) => rowSum + Number(row.amountBdt || 0),
        0
      ),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Purchase & Received Orders
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Purchase Orders selected for {merchant.name}. This Merchant view is
          read-only; Admin/Manager keep the receiving and payment controls.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Purchase Orders" value={String(orders.length)} />
          <Stat label="Ordered Qty" value={orderedQty.toLocaleString("en-BD")} />
          <Stat label="Received Qty" value={receivedQty.toLocaleString("en-BD")} />
          <Stat label="Paid BDT" value={formatTaka(paidBdt)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Invoice</th>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Order Date</th>
                <th className="px-5 py-4 text-right">Ordered Qty</th>
                <th className="px-5 py-4 text-right">Subtotal USD</th>
                <th className="px-5 py-4 text-right">Paid BDT</th>
                <th className="px-5 py-4 text-right">Received Qty</th>
                <th className="px-5 py-4 text-right">Received Cost</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paid = order.payments.reduce(
                  (sum, row) => sum + Number(row.amountBdt || 0),
                  0
                );
                const received = order.receivedOrders.reduce(
                  (sum, row) => sum + Number(row.receivedQty || 0),
                  0
                );
                const receivedCost = order.receivedOrders.reduce(
                  (sum, row) => sum + Number(row.grandTotalBdt || 0),
                  0
                );

                return (
                  <tr key={order.id} className="border-t align-top">
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {order.invoiceNo}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{order.productSku}</p>
                      <p className="text-xs text-slate-500">
                        {order.productName} · Parent {order.parentSku}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {order.orderDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {order.quantity} {order.quantityType}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {formatUsd(Number(order.subtotalUsd))}
                    </td>
                    <td className="px-5 py-4 text-right">{formatTaka(paid)}</td>
                    <td className="px-5 py-4 text-right">{received}</td>
                    <td className="px-5 py-4 text-right">
                      {formatTaka(receivedCost)}
                    </td>
                    <td className="px-5 py-4">{order.status}</td>
                  </tr>
                );
              })}
              {!orders.length ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                    No Purchase Order has been assigned to your Merchant account.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
