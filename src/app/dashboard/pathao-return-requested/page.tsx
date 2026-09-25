import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  isPathaoReturnRequestedState,
  isReturnRequestedWebhookEvent,
} from "@/lib/pathao/return-requested";
import {
  MarkReattemptButton,
  RefreshReturnRequestedButton,
} from "./action-buttons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "AGENT", "NOTE_AGENT", "PACKAGING_AGENT"];
const FINAL_RETURN_EVENTS = new Set([
  "order.return-id-created",
  "order.return-in-transit",
  "order.returned-to-merchant",
]);

type Props = {
  searchParams?: Promise<{
    courier?: string;
    q?: string;
    show?: string;
  }>;
};

function returnActionDeadlineUtc(detectedAt: Date) {
  const businessDate = getBangladeshDateInputValue(detectedAt);
  const [year, month, day] = businessDate.split("-").map(Number);

  // Pathao's stated deadline is 6:00 PM Bangladesh time on the following day.
  // Bangladesh is UTC+6 all year, so 18:00 Asia/Dhaka = 12:00 UTC.
  return new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0, 0));
}

function statusText(value: string | null | undefined) {
  return String(value || "").trim() || "N/A";
}

export default async function PathaoReturnRequestedPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const courierFilter = String(params.courier || "").trim();
  const q = String(params.q || "").trim();
  const show = String(params.show || "active").trim();

  const couriers = await prisma.courier.findMany({
    where: { pathaoEnabled: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const rawOrders = await prisma.order.findMany({
    where: {
      pathaoConsignmentId: { not: null },
      ...(courierFilter ? { pathaoCourierId: courierFilter } : {}),
      ...(q
        ? {
            OR: [
              { invoiceId: { contains: q } },
              { orderId: { contains: q } },
              { externalOrderId: { contains: q } },
              { phone: { contains: q } },
              { customerName: { contains: q } },
              { pathaoConsignmentId: { contains: q } },
            ],
          }
        : {}),
      AND: [
        {
          OR: [
            { pathaoOrderStatus: { contains: "return" } },
            { pathaoOrderStatusSlug: { contains: "return" } },
            {
              pathaoWebhookEvents: {
                some: { eventName: "order.returned" },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      invoiceId: true,
      orderId: true,
      externalOrderId: true,
      customerName: true,
      phone: true,
      address: true,
      totalAmount: true,
      orderStatus: true,
      pathaoConsignmentId: true,
      pathaoOrderStatus: true,
      pathaoOrderStatusSlug: true,
      pathaoLastSyncedAt: true,
      pathaoSubmittedAt: true,
      pathaoCourier: { select: { id: true, name: true, slug: true } },
      pathaoWebhookEvents: {
        orderBy: { receivedAt: "desc" },
        take: 12,
        select: {
          id: true,
          eventName: true,
          receivedAt: true,
          rawPayload: true,
        },
      },
      auditEvents: {
        where: { eventType: "PATHAO_REATTEMPT_REQUESTED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          actorLabel: true,
          performedByUser: { select: { name: true, username: true } },
        },
      },
    },
    orderBy: { pathaoLastSyncedAt: "desc" },
    take: 500,
  });

  const now = new Date();

  const rows = rawOrders
    .map((order) => {
      const latestEvent = order.pathaoWebhookEvents[0] || null;
      const latestFinalEvent = order.pathaoWebhookEvents.find((event) =>
        FINAL_RETURN_EVENTS.has(event.eventName)
      );
      const latestRequestEvent = order.pathaoWebhookEvents.find((event) =>
        isReturnRequestedWebhookEvent(event.eventName)
      );

      const currentIsRequested = isPathaoReturnRequestedState(
        order.pathaoOrderStatus,
        order.pathaoOrderStatusSlug,
        latestEvent?.eventName || null
      );

      const requestStillLatest =
        Boolean(latestRequestEvent) &&
        (!latestFinalEvent ||
          latestRequestEvent!.receivedAt.getTime() > latestFinalEvent.receivedAt.getTime());

      if (!currentIsRequested && !requestStillLatest) return null;

      const detectedAt =
        latestRequestEvent?.receivedAt ||
        order.pathaoLastSyncedAt ||
        order.pathaoSubmittedAt ||
        new Date();
      const deadline = returnActionDeadlineUtc(detectedAt);
      const expired = now.getTime() > deadline.getTime();
      const lastMarked = order.auditEvents[0] || null;
      const markedForCurrentRequest = Boolean(
        lastMarked && lastMarked.createdAt.getTime() >= detectedAt.getTime()
      );

      return {
        ...order,
        detectedAt,
        deadline,
        expired,
        lastMarked,
        markedForCurrentRequest,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => (show === "all" ? true : !row.expired))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  const activeCount = rows.filter((row) => !row.expired).length;
  const expiredCount = rows.filter((row) => row.expired).length;
  const markedCount = rows.filter((row) => row.markedForCurrentRequest).length;
  const courierCount = new Set(rows.map((row) => row.pathaoCourier?.id).filter(Boolean)).size;

  const resetHref = "/dashboard/pathao-return-requested";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pathao Return Requested
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">
              Review Pathao parcels marked for return and quickly open the parcel in
              Merchant Panel to request a free delivery reattempt before the Pathao deadline.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 lg:max-w-md">
            <b>Reattempt action:</b> Pathao currently documents this action in the Merchant
            Panel, not in the public Developer API. Use <b>Open in Pathao</b>, submit the
            reattempt there, then mark it in OMS for your team audit.
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Shown</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Actionable</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Reattempt Marked</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{markedCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">
            {show === "all" ? "Expired" : "Couriers"}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {show === "all" ? expiredCount : courierCount}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_0.8fr_auto_auto]">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Search</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Invoice / phone / customer / Pathao CID"
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Courier</span>
            <select
              name="courier"
              defaultValue={courierFilter}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="">All Pathao Couriers</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">List</span>
            <select
              name="show"
              defaultValue={show}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="active">Actionable only</option>
              <option value="all">Include expired</option>
            </select>
          </label>
          <button className="self-end rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Filter
          </button>
          <Link
            href={resetHref}
            className="self-end rounded-xl border px-5 py-2.5 text-center text-sm font-semibold text-slate-700"
          >
            Reset
          </Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Return Requested Orders</h2>
          <p className="mt-1 text-sm text-slate-500">
            This list mirrors Pathao Merchant Panel's <b>Return Requested</b> queue. Pathao's
            public order status/webhook can still report the underlying lifecycle as
            <b>Return</b> / <b>order.returned</b>; OMS maps that raw value to the Merchant Panel
            label here while keeping the raw API status visible underneath.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">Pathao CID</th>
                <th className="px-4 py-3">Pathao Panel Status</th>
                <th className="px-4 py-3">Return Marked</th>
                <th className="px-4 py-3">Action Deadline</th>
                <th className="px-4 py-3">OMS Reattempt Log</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-900">
                      {row.invoiceId || row.orderId || row.externalOrderId || row.id}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">OMS: {row.orderStatus}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{row.customerName}</p>
                    <p className="mt-1 text-xs text-slate-600">{row.phone}</p>
                    <p className="mt-1 max-w-[260px] text-xs text-slate-500">{row.address}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{row.pathaoCourier?.name || "N/A"}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    {row.pathaoConsignmentId}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Return Requested
                    </span>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Pathao API: {statusText(row.pathaoOrderStatus || row.pathaoOrderStatusSlug)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Synced {formatBangladeshDateTime(row.pathaoLastSyncedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-700">
                    {formatBangladeshDateTime(row.detectedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <p className={`font-semibold ${row.expired ? "text-red-600" : "text-emerald-700"}`}>
                      {row.expired ? "Expired" : "Action available"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatBangladeshDateTime(row.deadline)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {row.markedForCurrentRequest && row.lastMarked ? (
                      <>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Reattempt requested
                        </span>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.lastMarked.performedByUser?.name ||
                            row.lastMarked.performedByUser?.username ||
                            row.lastMarked.actorLabel ||
                            "OMS user"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatBangladeshDateTime(row.lastMarked.createdAt)}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Not marked</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="ml-auto flex w-44 flex-col gap-2">
                      <a
                        href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(
                          row.pathaoConsignmentId || ""
                        )}?isShowingActive=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Open in Pathao
                      </a>
                      <MarkReattemptButton
                        orderId={row.id}
                        alreadyMarked={row.markedForCurrentRequest}
                      />
                      <RefreshReturnRequestedButton orderId={row.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No Pathao Return Requested parcels matched this filter.
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
