import Link from "next/link";
import ReadyToShipClient from "./ready-to-ship-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReadyToShipPageProps = {
  searchParams?: Promise<{
    courier?: string;
    from?: string;
    to?: string;
    tab?: string;
  }>;
};

function formatDateTime(date: Date) {
  return date.toLocaleString();
}

export default async function ReadyToShipPage({
  searchParams,
}: ReadyToShipPageProps) {
  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const courier = (params.courier || "").trim();
  const from = (params.from || "").trim();
  const to = (params.to || "").trim();
  const activeTab = (params.tab || "non-invoiced").trim();

  const couriers = await prisma.courier.findMany({
    where: {
      status: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const courierOptions = [
    { value: "", label: "All Couriers" },
    ...couriers.map((courierItem) => ({
      value: courierItem.slug,
      label: courierItem.name,
    })),
  ];

  const whereBase: Record<string, unknown> = {
    orderStatus: "READY_TO_SHIP",
  };

  if (courier) {
    whereBase.courier = courier;
  }

  if (from || to) {
    whereBase.readyToShipAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    };
  }

  const ordersWhere =
    activeTab === "non-invoiced"
      ? { ...whereBase, invoiceDownloaded: false }
      : activeTab === "invoiced"
      ? { ...whereBase, invoiceDownloaded: true }
      : activeTab === "non-csv"
      ? { ...whereBase, csvDownloaded: false }
      : { ...whereBase, csvDownloaded: true };

  const [
    orders,
    nonInvoicedCount,
    invoicedCount,
    nonCsvCount,
    csvDownloadedCount,
    invoiceBatches,
    csvBatches,
  ] = await Promise.all([
    prisma.order.findMany({
      where: ordersWhere,
      include: {
        items: true,
      },
      orderBy: {
        readyToShipAt: "desc",
      },
      take: 200,
    }),
    prisma.order.count({
      where: { ...whereBase, invoiceDownloaded: false },
    }),
    prisma.order.count({
      where: { ...whereBase, invoiceDownloaded: true },
    }),
    prisma.order.count({
      where: { ...whereBase, csvDownloaded: false },
    }),
    prisma.order.count({
      where: { ...whereBase, csvDownloaded: true },
    }),
    prisma.invoiceBatch.findMany({
      where: courier ? { courier } : undefined,
      include: {
        createdByUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
    prisma.csvBatch.findMany({
      where: courier ? { courier } : undefined,
      include: {
        createdByUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);

  const courierMap = Object.fromEntries(
    couriers.map((courierItem) => [courierItem.slug, courierItem.name])
  );

  const tabBase = `/dashboard/ready-to-ship?courier=${encodeURIComponent(
    courier
  )}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Ready to Ship</h1>
        <p className="mt-1 text-sm text-slate-500">
          Courier-wise shipment preparation with invoice and CSV batch history.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label
              htmlFor="courier"
              className="text-sm font-medium text-slate-700"
            >
              Courier
            </label>
            <select
              id="courier"
              name="courier"
              defaultValue={courier}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              {courierOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="from"
              className="text-sm font-medium text-slate-700"
            >
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="to" className="text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Link
          href={`${tabBase}&tab=non-invoiced`}
          className={`rounded-2xl border p-4 shadow-sm ${
            activeTab === "non-invoiced" ? "bg-slate-900 text-white" : "bg-white"
          }`}
        >
          <p className="text-sm font-medium">Non Invoiced</p>
          <p className="mt-2 text-2xl font-bold">{nonInvoicedCount}</p>
        </Link>

        <Link
          href={`${tabBase}&tab=invoiced`}
          className={`rounded-2xl border p-4 shadow-sm ${
            activeTab === "invoiced" ? "bg-slate-900 text-white" : "bg-white"
          }`}
        >
          <p className="text-sm font-medium">Invoice Downloaded</p>
          <p className="mt-2 text-2xl font-bold">{invoicedCount}</p>
        </Link>

        <Link
          href={`${tabBase}&tab=non-csv`}
          className={`rounded-2xl border p-4 shadow-sm ${
            activeTab === "non-csv" ? "bg-slate-900 text-white" : "bg-white"
          }`}
        >
          <p className="text-sm font-medium">Non CSV</p>
          <p className="mt-2 text-2xl font-bold">{nonCsvCount}</p>
        </Link>

        <Link
          href={`${tabBase}&tab=csv-downloaded`}
          className={`rounded-2xl border p-4 shadow-sm ${
            activeTab === "csv-downloaded" ? "bg-slate-900 text-white" : "bg-white"
          }`}
        >
          <p className="text-sm font-medium">CSV Downloaded</p>
          <p className="mt-2 text-2xl font-bold">{csvDownloadedCount}</p>
        </Link>
      </section>

      <ReadyToShipClient
        courier={courier}
        activeTab={activeTab}
        courierMap={courierMap}
        orders={orders.map((order) => ({
          id: order.id,
          invoiceId: order.invoiceId,
          customerName: order.customerName,
          phone: order.phone,
          courier: order.courier,
          totalAmount: Number(order.totalAmount),
          createdAt: formatDateTime(order.readyToShipAt),
          items: order.items.map((item) => ({
            id: item.id,
            productSku: item.productSku,
            quantity: item.quantity,
          })),
        }))}
        invoiceBatches={invoiceBatches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          courier: batch.courier,
          totalOrders: batch.totalOrders,
          createdAt: formatDateTime(batch.createdAt),
          createdByName: batch.createdByUser.name,
          downloadUrl: `/api/ready-to-ship/invoice-batch/${batch.id}`,
        }))}
        csvBatches={csvBatches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          courier: batch.courier,
          totalOrders: batch.totalOrders,
          createdAt: formatDateTime(batch.createdAt),
          createdByName: batch.createdByUser.name,
          downloadUrl: `/api/ready-to-ship/csv-batch/${batch.id}`,
        }))}
      />
    </div>
  );
}