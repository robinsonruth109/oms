import { prisma } from "@/lib/prisma";
import PendingOrdersTable from "./pending-orders-table";

export default async function PendingOrdersPage() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: "PENDING_CONFIRMATION",
    },
    include: {
      items: true,
      source: true,
      integration: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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

  const sourceStats = Object.values(
    serializedOrders.reduce<
      Record<
        string,
        {
          id: string;
          name: string;
          count: number;
        }
      >
    >((acc, order) => {
      const key = order.source.id;

      if (!acc[key]) {
        acc[key] = {
          id: order.source.id,
          name: order.source.name,
          count: 0,
        };
      }

      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const totalPendingOrders = serializedOrders.length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Pending Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read-only inbox for imported website orders waiting for calling action.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Pending</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {totalPendingOrders}
          </p>
          <p className="mt-1 text-xs text-slate-400">All sources combined</p>
        </div>

        {sourceStats.map((source) => (
          <div
            key={source.id}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{source.name}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {source.count}
            </p>
            <p className="mt-1 text-xs text-slate-400">Pending Orders</p>
          </div>
        ))}
      </section>

      <PendingOrdersTable orders={serializedOrders} />
    </div>
  );
}