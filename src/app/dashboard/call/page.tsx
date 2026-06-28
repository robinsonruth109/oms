import Link from "next/link";
import CallingPanelTable from "./calling-panel-table";

type CallingPanelPageProps = {
  searchParams?: Promise<{
    source?: string;
    importedFrom?: string;
    importedTo?: string;
    page?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export default async function CallingPanelPage({
  searchParams,
}: CallingPanelPageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const source = (params.source || "").trim();
  const importedFrom = (params.importedFrom || "").trim();
  const importedTo = (params.importedTo || "").trim();

  const currentPage = Math.max(Number(params.page || 1), 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where: Record<string, any> = {
    orderStatus: {
      in: ["PENDING_CONFIRMATION", "NO_ANSWER", "PHONE_OFF"],
    },
  };

  if (source) {
    where.sourceId = source;
  }

  if (importedFrom || importedTo) {
    where.createdAt = {
      ...(importedFrom ? { gte: new Date(`${importedFrom}T00:00:00`) } : {}),
      ...(importedTo ? { lte: new Date(`${importedTo}T23:59:59.999`) } : {}),
    };
  }

  const [
  totalOrders,
  alreadyCalledCount,
  notCalledCount,
  singleItemOrderRows,
  orders,
  couriers,
  products,
  sources,
  pages,
] = await Promise.all([
  prisma.order.count({ where }),

  prisma.order.count({
    where: {
      ...where,
      calledAt: {
        not: null,
      },
    },
  }),

  prisma.order.count({
    where: {
      ...where,
      calledAt: null,
    },
  }),

  prisma.order.findMany({
    where,
    select: {
      id: true,
      items: {
        select: {
          id: true,
        },
      },
    },
  }),

  prisma.order.findMany({
    where,
    include: {
      items: true,
      source: true,
      integration: true,
      calledByUser: true,
      page: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
  }),

  prisma.courier.findMany({
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
  }),

  prisma.product.findMany({
    where: {
      status: true,
    },
    orderBy: {
      sku: "asc",
    },
    include: {
      parent: true,
    },
  }),

  prisma.orderSource.findMany({
    where: {
      status: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  }),

  prisma.page.findMany({
    where: {
      status: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      prefixCode: true,
    },
  }),
]);

const queueSummary = {
  total: totalOrders,
  alreadyCalled: alreadyCalledCount,
  notCalled: notCalledCount,
  singleItemOrders: singleItemOrderRows.filter(
    (order) => order.items.length === 1
  ).length,
};
  const totalPages = Math.max(Math.ceil(totalOrders / PAGE_SIZE), 1);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  function buildPageUrl(pageNumber: number) {
    const query = new URLSearchParams();

    if (source) query.set("source", source);
    if (importedFrom) query.set("importedFrom", importedFrom);
    if (importedTo) query.set("importedTo", importedTo);

    query.set("page", String(pageNumber));

    return `/dashboard/call?${query.toString()}`;
  }

  const serializedOrders = orders.map((order) => ({
    id: order.id,
    orderId: order.orderId,
    invoiceId: order.invoiceId,
    externalOrderId: order.externalOrderId,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    advance: Number(order.advance),
    deliveryCharge: Number(order.deliveryCharge),
    totalAmount: Number(order.totalAmount),
    orderStatus: order.orderStatus,
    courier: order.courier,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    readyToShipAt: order.readyToShipAt.toISOString().slice(0, 10),
    calledAt: order.calledAt ? order.calledAt.toISOString() : null,
    pageId: order.pageId,
    page: order.page
      ? {
          id: order.page.id,
          name: order.page.name,
          prefixCode: order.page.prefixCode,
        }
      : null,
    source: {
      id: order.source.id,
      name: order.source.name,
      type: order.source.type,
    },
    integration: order.integration
      ? {
          id: order.integration.id,
          name: order.integration.name,
          slug: order.integration.slug,
          platform: order.integration.platform,
        }
      : null,
    calledByUser: order.calledByUser
      ? {
          id: order.calledByUser.id,
          name: order.calledByUser.name,
          username: order.calledByUser.username,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }));

  const courierOptions = couriers.map((courier) => ({
    id: courier.id,
    name: courier.name,
    slug: courier.slug,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    sellingPrice: Number(product.sellingPrice),
    parentSku: product.parent.sku,
  }));

  const pageOptions = pages.map((page) => ({
    id: page.id,
    name: page.name,
    prefixCode: page.prefixCode,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Calling Panel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Agent workspace for calling, editing and updating website orders.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input type="hidden" name="page" value="1" />

          <div className="space-y-2">
            <label htmlFor="source" className="text-sm font-medium text-slate-700">
              Source
            </label>
            <select
              id="source"
              name="source"
              defaultValue={source}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Sources</option>
              {sources.map((sourceItem) => (
                <option key={sourceItem.id} value={sourceItem.id}>
                  {sourceItem.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="importedFrom" className="text-sm font-medium text-slate-700">
              Imported From
            </label>
            <input
              id="importedFrom"
              name="importedFrom"
              type="date"
              defaultValue={importedFrom}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="importedTo" className="text-sm font-medium text-slate-700">
              Imported To
            </label>
            <input
              id="importedTo"
              name="importedTo"
              type="date"
              defaultValue={importedTo}
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

      <div className="rounded-2xl border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        Showing page <span className="font-semibold">{currentPage}</span> of{" "}
        <span className="font-semibold">{totalPages}</span> —{" "}
        <span className="font-semibold">{orders.length}</span> loaded from{" "}
        <span className="font-semibold">{totalOrders}</span> total orders.
      </div>

      <CallingPanelTable
        orders={serializedOrders}
        couriers={courierOptions}
        products={productOptions}
        pages={pageOptions}
        queueSummary={queueSummary}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasPrevPage ? (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className="rounded-xl border bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : null}

        {hasNextPage ? (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Load More / Next 20
          </Link>
        ) : null}
      </div>
    </div>
  );
}