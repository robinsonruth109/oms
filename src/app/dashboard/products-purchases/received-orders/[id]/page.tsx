import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function money(value: number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

function usd(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ReceivedOrderDetailsPage({
  params,
}: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: {
      id,
    },
    include: {
      payments: {
        orderBy: {
          paymentDate: "asc",
        },
      },

      receivedOrders: {
        orderBy: {
          receiveDate: "asc",
        },
      },

      product: {
        include: {
          parent: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const totalPaidUsd = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountUsd),
    0
  );

  const totalPaidBdt = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountBdt),
    0
  );

  const totalReceivedQty = order.receivedOrders.reduce(
    (sum, item) => sum + Number(item.receivedQty),
    0
  );

  const totalCnfCharge = order.receivedOrders.reduce(
    (sum, item) => sum + Number(item.totalCnfCharge),
    0
  );

  const totalOtherCost = order.receivedOrders.reduce(
    (sum, item) => sum + Number(item.otherCostBdt),
    0
  );

  const totalGrandTotal = order.receivedOrders.reduce(
    (sum, item) => sum + Number(item.grandTotalBdt),
    0
  );

  const averageOriginalPrice =
    totalReceivedQty > 0
      ? totalGrandTotal / totalReceivedQty
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Received Order Details
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Invoice: {order.invoiceNo}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Information
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoBox
              label="Product SKU"
              value={order.productSku}
            />

            <InfoBox
              label="Product Name"
              value={order.productName}
            />

            <InfoBox
              label="Parent Code"
              value={order.parentSku}
            />

            <InfoBox
              label="Order Date"
              value={formatDate(order.orderDate)}
            />

            <InfoBox
              label="Ordered Quantity"
              value={`${order.quantity} ${order.quantityType}`}
            />

            <InfoBox
              label="Status"
              value={order.status}
            />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Image
          </h2>

          {order.productImage ? (
            <img
              src={order.productImage}
              alt={order.productName}
              className="mt-5 h-64 w-full rounded-2xl border object-cover"
            />
          ) : (
            <div className="mt-5 flex h-64 items-center justify-center rounded-2xl border bg-slate-50 text-sm text-slate-500">
              No image added
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Total Paid USD"
          value={usd(totalPaidUsd)}
        />

        <SummaryCard
          title="Total Paid BDT"
          value={money(totalPaidBdt)}
        />

        <SummaryCard
          title="Received Qty"
          value={String(totalReceivedQty)}
        />

        <SummaryCard
          title="Total CNF Charge"
          value={money(totalCnfCharge)}
        />

        <SummaryCard
          title="Other Costs"
          value={money(totalOtherCost)}
        />

        <SummaryCard
          title="Average Original Price"
          value={money(averageOriginalPrice)}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Payment History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>USD</TableHead>
                <TableHead>USD Rate</TableHead>
                <TableHead>BDT</TableHead>
                <TableHead>Note</TableHead>
              </tr>
            </thead>

            <tbody>
              {order.payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <TableCell>
                    {formatDate(payment.paymentDate)}
                  </TableCell>

                  <TableCell>
                    {payment.paymentType}
                  </TableCell>

                  <TableCell>
                    {usd(Number(payment.amountUsd))}
                  </TableCell>

                  <TableCell>
                    {Number(payment.usdRate).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    {money(Number(payment.amountBdt))}
                  </TableCell>

                  <TableCell>
                    {payment.note || "N/A"}
                  </TableCell>
                </tr>
              ))}

              {!order.payments.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Receive History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <TableHead>Date</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Package Weight</TableHead>
                <TableHead>CNF Rate</TableHead>
                <TableHead>CNF Charge</TableHead>
                <TableHead>Other Cost</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Note</TableHead>
              </tr>
            </thead>

            <tbody>
              {order.receivedOrders.map((receive) => (
                <tr key={receive.id} className="border-b">
                  <TableCell>
                    {formatDate(receive.receiveDate)}
                  </TableCell>

                  <TableCell>
                    {receive.receivedQty}
                  </TableCell>

                  <TableCell>
                    {Number(receive.packageWeight).toFixed(2)} KG
                  </TableCell>

                  <TableCell>
                    {money(Number(receive.cnfRatePerKg))}
                  </TableCell>

                  <TableCell>
                    {money(Number(receive.totalCnfCharge))}
                  </TableCell>

                  <TableCell>
                    {money(Number(receive.otherCostBdt))}
                  </TableCell>

                  <TableCell>
                    {money(Number(receive.grandTotalBdt))}
                  </TableCell>

                  <TableCell>
                    {money(Number(receive.unitOriginalCost))}
                  </TableCell>

                  <TableCell>
                    {receive.note || "N/A"}
                  </TableCell>
                </tr>
              ))}

              {!order.receivedOrders.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No receive history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Purchase Note
        </h2>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {order.note || "No note added."}
        </div>
      </section>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function TableHead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="px-5 py-4 text-sm text-slate-700">
      {children}
    </td>
  );
}