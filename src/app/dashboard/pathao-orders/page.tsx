import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";
import RefreshPathaoButton from "./refresh-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ q?: string; courier?: string }>;
};

export default async function PathaoOrderControlPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const courierFilter = String(params.courier || "").trim();

  const [couriers, orders, recentEvents] = await Promise.all([
    prisma.courier.findMany({
      where: { pathaoEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.order.findMany({
      where: {
        pathaoCourierId: courierFilter || undefined,
        ...(q
          ? {
              OR: [
                { pathaoConsignmentId: { contains: q } },
                { invoiceId: { contains: q } },
                { orderId: { contains: q } },
                { externalOrderId: { contains: q } },
                { phone: { contains: q } },
                { pathaoMerchantOrderId: { contains: q } },
              ],
            }
          : {
              OR: [
                { pathaoCourierId: { not: null } },
                { pathaoSubmissionStatus: { not: "NOT_SUBMITTED" } },
              ],
            }),
      },
      include: {
        pathaoCourier: true,
        items: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.pathaoWebhookEvent.findMany({
      include: { courier: true, order: true },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Pathao Order Control
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search by consignment ID, OMS invoice/order ID or phone number. OMS status and Pathao status remain separate.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Consignment ID / Invoice / Order ID / Phone"
            className="rounded-xl border px-3 py-2.5"
          />
          <select name="courier" defaultValue={courierFilter} className="rounded-xl border px-3 py-2.5">
            <option value="">All Pathao Couriers</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white">
            Search
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Pathao Orders</h2>
          <p className="mt-1 text-sm text-slate-500">{orders.length} order(s) shown</p>
        </div>

        <div className="space-y-4 p-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <p className="text-xs uppercase text-slate-400">OMS Order</p>
                  <p className="font-semibold text-slate-900">
                    {order.invoiceId || order.orderId || order.externalOrderId || order.id}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {order.customerName} · {order.phone}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{order.address}</p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">Pathao</p>
                  <p className="font-semibold">
                    {order.pathaoConsignmentId || "Waiting for consignment ID"}
                  </p>
                  <p className="mt-1 text-sm">
                    {order.pathaoCourier?.name || order.courier || "N/A"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Submission: {order.pathaoSubmissionStatus}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">Statuses</p>
                  <p className="text-sm">OMS: <strong>{order.orderStatus}</strong></p>
                  <p className="mt-1 text-sm">
                    Pathao: <strong>{order.pathaoOrderStatus || order.pathaoOrderStatusSlug || "Pending webhook"}</strong>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted: {formatBangladeshDateTime(order.pathaoSubmittedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Synced: {formatBangladeshDateTime(order.pathaoLastSyncedAt)}
                  </p>
                  {order.pathaoLastError ? (
                    <p className="mt-2 text-xs text-red-600">{order.pathaoLastError}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <RefreshPathaoButton orderId={order.id} />
                  {order.pathaoConsignmentId ? (
                    <a
                      href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(order.pathaoConsignmentId)}?isShowingActive=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      View in Pathao
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {!orders.length ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No Pathao order matched your search.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Recent Webhook Events</h2>
          <p className="mt-1 text-sm text-slate-500">
            Raw payloads are stored in the database even when the OMS order cannot be matched yet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Courier</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Consignment</th>
                <th className="px-5 py-3">Merchant Order</th>
                <th className="px-5 py-3">Processed</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="px-5 py-3">{formatBangladeshDateTime(event.receivedAt)}</td>
                  <td className="px-5 py-3">{event.courier.name}</td>
                  <td className="px-5 py-3">{event.eventName}</td>
                  <td className="px-5 py-3">{event.consignmentId || "—"}</td>
                  <td className="px-5 py-3">{event.merchantOrderId || "—"}</td>
                  <td className="px-5 py-3">{event.processed ? "Yes" : "No"}</td>
                </tr>
              ))}
              {!recentEvents.length ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No webhook events received yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
