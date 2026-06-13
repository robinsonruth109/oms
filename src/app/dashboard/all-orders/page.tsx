import Link from "next/link";
import AllOrdersTable from "./all-orders-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 100;

type AllOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function AllOrdersPage({
  searchParams,
}: AllOrdersPageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const q = (params.q || "").trim();
  const currentPage = Math.max(Number(params.page || 1), 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where = q
    ? {
        OR: [
          { invoiceId: { contains: q } },
          { phone: { contains: q } },
          { externalOrderId: { contains: q } },
          { customerName: { contains: q } },
        ],
      }
    : undefined;

  const [totalOrders, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        source: true,
        page: true,
        integration: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(Math.ceil(totalOrders / PAGE_SIZE), 1);

  function buildPageUrl(pageNumber: number) {
    const query = new URLSearchParams();

    if (q) query.set("q", q);
    query.set("page", String(pageNumber));

    return `/dashboard/all-orders?${query.toString()}`;
  }

  const serializedOrders = orders.map((order) => ({
    id: order.id,
    invoiceId: order.invoiceId,
    externalOrderId: order.externalOrderId,
    customerName: order.customerName,
    phone: order.phone,
    orderStatus: order.orderStatus,
    totalAmount: Number(order.totalAmount),
    sourceName: order.source?.name || "N/A",
    pageName: order.page?.name || "N/A",
    items: order.items.map((item) => ({
      id: item.id,
      productSku: item.productSku,
      quantity: item.quantity,
    })),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">All Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, manage, update and bulk delete orders.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input type="hidden" name="page" value="1" />

          <div className="space-y-2 md:col-span-3">
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

      <div className="rounded-2xl border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        Showing page <span className="font-semibold">{currentPage}</span> of{" "}
        <span className="font-semibold">{totalPages}</span> —{" "}
        <span className="font-semibold">{orders.length}</span> loaded from{" "}
        <span className="font-semibold">{totalOrders}</span> total orders.
      </div>

      <AllOrdersTable orders={serializedOrders} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        {currentPage > 1 ? (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className="rounded-xl border bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Previous 100
          </Link>
        ) : null}

        {currentPage < totalPages ? (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Next 100
          </Link>
        ) : null}
      </div>
    </div>
  );
}