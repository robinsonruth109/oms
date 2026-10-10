import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  formatTaka,
  normalizePathaoEvent,
  numberValue,
  rawNumber,
  requireMerchantContext,
  validDate,
} from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

export default async function MerchantPathaoReportPage({
  searchParams,
}: Props) {
  const { merchant } = await requireMerchantContext();
  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);
  const courierIds = merchant.couriers.map((row) => row.courierId);

  const webhooks = courierIds.length
    ? await prisma.pathaoWebhookEvent.findMany({
        where: {
          signatureValid: true,
          processed: true,
          orderId: { not: null },
          receivedAt: { gte: start, lte: end },
          courierId: { in: courierIds },
          order: {
            items: {
              some: {
                product: {
                  parent: { merchantId: merchant.id },
                },
              },
            },
          },
        },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          orderId: true,
          eventName: true,
          receivedAt: true,
          rawPayload: true,
        },
      })
    : [];

  const orderIds = Array.from(
    new Set(
      webhooks
        .map((row) => row.orderId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          invoiceId: true,
          orderId: true,
          totalAmount: true,
          advance: true,
          deliveryCharge: true,
          pathaoDeliveryFee: true,
          pathaoAmountToCollect: true,
          pathaoAuthorizedCodAmount: true,
          pathaoConsignmentId: true,
          pathaoCourier: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              lineTotal: true,
              productSku: true,
              product: {
                select: {
                  parent: {
                    select: { merchantId: true, sku: true },
                  },
                },
              },
            },
          },
        },
      })
    : [];

  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const eventMap = new Map<string, typeof webhooks>();

  for (const webhook of webhooks) {
    if (!webhook.orderId) continue;
    const current = eventMap.get(webhook.orderId) || [];
    current.push(webhook);
    eventMap.set(webhook.orderId, current);
  }

  const reportRows: {
    id: string;
    invoice: string;
    courier: string;
    consignment: string;
    latest: string;
    bucket: "DELIVERED" | "RETURNED" | "CANCELLED" | "PENDING";
    qty: number;
    codShare: number;
    deliveryCost: number;
    returnCost: number;
  }[] = [];

  for (const [orderId, events] of eventMap) {
    const order = orderMap.get(orderId);
    if (!order) continue;

    let latest = "unknown";
    let latestAt = -1;
    let deliveredAt = -1;
    let returnedAt = -1;
    let deliveredPayload: unknown = null;
    let returnCost = 0;

    for (const event of events) {
      const name = normalizePathaoEvent(event.eventName);
      const time = event.receivedAt.getTime();

      if (time >= latestAt) {
        latestAt = time;
        latest = name;
      }

      if (name === "order.delivered" || name === "delivered") {
        deliveredAt = time;
        deliveredPayload = event.rawPayload;
      }

      if (
        name === "order.returned" ||
        name === "order.return" ||
        name === "order.return-id-created" ||
        name === "order.return-in-transit" ||
        name === "order.returned-to-merchant" ||
        name === "order.paid-return" ||
        name === "returned" ||
        name === "return" ||
        name === "paid-return"
      ) {
        returnedAt = Math.max(returnedAt, time);
      }

      if (name === "order.paid-return" || name === "paid-return") {
        const fee = rawNumber(event.rawPayload, [
          "collected_amount",
          "return_charge",
          "return_fee",
        ]);
        if (fee !== null) returnCost = Math.max(0, fee);
      }
    }

    const returned = returnedAt >= 0 && returnedAt >= deliveredAt;
    const delivered = deliveredAt >= 0 && deliveredAt > returnedAt;
    const cancelled = !delivered && !returned && latest.includes("cancel");

    const allLineTotal = order.items.reduce(
      (sum, item) => sum + numberValue(item.lineTotal),
      0
    );
    const merchantItems = order.items.filter(
      (item) => item.product?.parent.merchantId === merchant.id
    );
    const merchantLineTotal = merchantItems.reduce(
      (sum, item) => sum + numberValue(item.lineTotal),
      0
    );
    const share =
      allLineTotal > 0
        ? merchantLineTotal / allLineTotal
        : merchantItems.length / Math.max(1, order.items.length);

    const qty = merchantItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const deliveryFeeRaw = delivered
      ? rawNumber(deliveredPayload, ["delivery_fee"])
      : null;
    const deliveryCost = delivered
      ? Math.max(
          0,
          deliveryFeeRaw !== null
            ? deliveryFeeRaw
            : numberValue(order.pathaoDeliveryFee)
        ) * share
      : 0;

    const collected = delivered
      ? rawNumber(deliveredPayload, [
          "collected_amount",
          "amount_collected",
          "amount_to_collect",
          "cod_amount",
        ])
      : null;
    const cod =
      delivered
        ? collected !== null
          ? Math.max(0, collected)
          : numberValue(order.pathaoAmountToCollect) ||
            numberValue(order.pathaoAuthorizedCodAmount) ||
            numberValue(order.totalAmount)
        : 0;

    reportRows.push({
      id: order.id,
      invoice: order.invoiceId || order.orderId || order.id,
      courier: order.pathaoCourier?.name || "Pathao",
      consignment: order.pathaoConsignmentId || "—",
      latest,
      bucket: delivered
        ? "DELIVERED"
        : returned
          ? "RETURNED"
          : cancelled
            ? "CANCELLED"
            : "PENDING",
      qty,
      codShare: cod * share,
      deliveryCost,
      returnCost: returnCost * share,
    });
  }

  const deliveredCount = reportRows.filter(
    (row) => row.bucket === "DELIVERED"
  ).length;
  const returnedCount = reportRows.filter(
    (row) => row.bucket === "RETURNED"
  ).length;
  const cancelledCount = reportRows.filter(
    (row) => row.bucket === "CANCELLED"
  ).length;
  const pendingCount = reportRows.filter(
    (row) => row.bucket === "PENDING"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Pathao Delivery Report
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Verified webhook report for {merchant.name}, limited to couriers
              assigned by Admin.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </div>

        {!courierIds.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No courier has been assigned to this Merchant yet. Ask Admin to
            assign a courier from Merchant Control.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <Stat label="Invoices" value={String(reportRows.length)} />
          <Stat label="Delivered" value={String(deliveredCount)} tone="green" />
          <Stat label="Returned" value={String(returnedCount)} tone="red" />
          <Stat label="Cancelled" value={String(cancelledCount)} tone="red" />
          <Stat label="Pending / Other" value={String(pendingCount)} tone="amber" />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Invoice / Consignment</th>
                <th className="px-5 py-4">Courier</th>
                <th className="px-5 py-4">Latest Webhook</th>
                <th className="px-5 py-4">Bucket</th>
                <th className="px-5 py-4 text-right">Product Qty</th>
                <th className="px-5 py-4 text-right">COD Share</th>
                <th className="px-5 py-4 text-right">Delivery Cost</th>
                <th className="px-5 py-4 text-right">Return Cost</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{row.invoice}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {row.consignment}
                    </p>
                  </td>
                  <td className="px-5 py-4">{row.courier}</td>
                  <td className="px-5 py-4">{row.latest}</td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-semibold " +
                        (row.bucket === "DELIVERED"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.bucket === "RETURNED" ||
                              row.bucket === "CANCELLED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700")
                      }
                    >
                      {row.bucket}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">{row.qty}</td>
                  <td className="px-5 py-4 text-right">
                    {formatTaka(row.codShare)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {formatTaka(row.deliveryCost)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {formatTaka(row.returnCost)}
                  </td>
                </tr>
              ))}
              {!reportRows.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No verified Pathao activity found in this date range.
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-slate-950";

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={"mt-1 text-xl font-bold " + toneClass}>{value}</p>
    </div>
  );
}
