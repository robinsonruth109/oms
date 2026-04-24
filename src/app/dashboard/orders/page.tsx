
import CreateOrderForm from "./create-order-form";


export const dynamic = "force-dynamic";
export const revalidate = 0;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    READY_TO_SHIP: "bg-emerald-100 text-emerald-700",
    PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
    NO_ANSWER: "bg-slate-200 text-slate-700",
    PHONE_OFF: "bg-slate-200 text-slate-700",
    CANCELLED: "bg-red-100 text-red-700",
    DOUBLE_ORDER: "bg-orange-100 text-orange-700",
    STOCK_OUT: "bg-purple-100 text-purple-700",
    RETURNED: "bg-pink-100 text-pink-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function CourierLabel({ courier }: { courier: string | null }) {
  if (!courier) return <span className="text-slate-400">N/A</span>;

  const labels: Record<string, string> = {
    CHINA_PATHAO: "China-Pathao",
    MACRO_PATHAO: "Macro-Pathao",
    TRENDY_SHOP_PATHAO: "Trendy Shop-Pathao",
    ALAMDANGA_PATHAO: "Alamdanga-Pathao",
    GLOWSS_PATHAO: "Glowss-Pathao",
    PATHAO_COSMO_CRAAZE_BD: "Pathao-Cosmo Craaze BD",
    PATHAO_UNIQUE_MART: "Pathao-Unique Mart",
    PATHAO_WOMANS_GLAMOUR: "Pathao-Woman's Glamour",
  };

  return <span>{labels[courier] || courier}</span>;
}

export default async function OrdersPage() {
  const { prisma } = await import("@/lib/prisma");
  const pages = await prisma.page.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      prefixCode: true,
    },
  });

  const sources = await prisma.orderSource.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  const couriers = await prisma.courier.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      page: true,
      source: true,
      items: true,
    },
    take: 20,
  });

  const products = await prisma.product.findMany({
    where: { status: true },
    orderBy: [
      { sku: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      parent: true,
    },
  });

  const productOptions = products
    .filter((product) => product.parent)
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      sellingPrice: Number(product.sellingPrice),
      parentSku: product.parent.sku,
    }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create manual orders with page, source, courier, multiple products,
          discount, advance and gradual invoice generation.
        </p>
      </section>

      <CreateOrderForm
        pages={pages}
        sources={sources}
        products={productOptions}
        couriers={couriers}
      />

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Latest Orders</h2>
          <p className="mt-1 text-sm text-slate-500">
            Showing the 20 most recent orders.
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
                <StatusBadge status={order.orderStatus} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Invoice</p>
                  <p className="font-medium text-slate-800">{order.invoiceId}</p>
                </div>
                <div>
                  <p className="text-slate-400">Courier</p>
                  <p className="font-medium text-slate-800">
                    <CourierLabel courier={order.courier} />
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Source</p>
                  <p className="font-medium text-slate-800">
                    {order.source.name}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Page</p>
                  <p className="font-medium text-slate-800">
                    {order.page?.name || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400">Items</p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <p key={item.id} className="font-medium text-slate-800">
                        {item.productSku} × {item.quantity}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400">Discount</p>
                  <p className="font-medium text-slate-800">
                    ৳ {Number(order.discount).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Advance</p>
                  <p className="font-medium text-slate-800">
                    ৳ {Number(order.advance).toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400">Final Total</p>
                  <p className="font-medium text-slate-800">
                    ৳ {Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
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
                  Page / Source
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Courier
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Items
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
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
                      <p className="font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <p className="text-slate-500">{order.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p>{order.page?.name || "N/A"}</p>
                      <p className="text-slate-500">{order.source.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <CourierLabel courier={order.courier} />
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
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    <div>
                      <p>Subtotal: ৳ {Number(order.subtotal).toFixed(2)}</p>
                      <p className="text-slate-500">
                        Final: ৳ {Number(order.totalAmount).toFixed(2)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.orderStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}