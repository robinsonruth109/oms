import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import ProductDeliveryStatusTable from "./product-delivery-status-table";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    source?: string;
    courier?: string;
    dateBasis?: string;
    view?: string;
  }>;
};

// These are Pathao webhook event names, not a snapshot from order.pathaoOrderStatus.
// Store Created and Store Updated are intentionally absent: store-level events
// have no OMS order or product quantity.
const PRIMARY_STATUS_COLUMNS = [
  "Order Created",
  "Order Updated",
  "Pickup Requested",
  "Assigned for Pickup",
  "Pickup",
  "Pickup Failed",
  "Pickup Cancelled",
  "At the Sorting HUB",
  "In Transit",
  "Received at Last Mile HUB",
  "Assigned for Delivery",
  "Delivered",
  "Partial Delivery",
  "Return",
  "Delivery Failed",
  "On Hold",
  "Payment Invoice",
  "Paid Return",
  "Exchange",
  "Return Id Created",
  "Return In Transit",
  "Returned To Merchant",
  "Paid",
] as const;

const WEBHOOK_LABELS: Record<string, string> = {
  "order.created": "Order Created",
  "order.updated": "Order Updated",
  "order.pickup-requested": "Pickup Requested",
  "order.assigned-for-pickup": "Assigned for Pickup",
  "order.pickup": "Pickup",
  "order.picked-up": "Pickup",
  "order.pickup-failed": "Pickup Failed",
  "order.pickup-cancelled": "Pickup Cancelled",
  "order.at-the-sorting-hub": "At the Sorting HUB",
  "order.in-transit": "In Transit",
  "order.received-at-last-mile-hub": "Received at Last Mile HUB",
  "order.assigned-for-delivery": "Assigned for Delivery",
  "order.delivered": "Delivered",
  "order.partial-delivery": "Partial Delivery",
  "order.returned": "Return",
  "order.return": "Return",
  "order.delivery-failed": "Delivery Failed",
  "order.on-hold": "On Hold",
  "order.payment-invoice": "Payment Invoice",
  "order.paid-return": "Paid Return",
  "order.exchange": "Exchange",
  "order.return-id-created": "Return Id Created",
  "order.return-in-transit": "Return In Transit",
  "order.returned-to-merchant": "Returned To Merchant",
  "order.paid": "Paid",
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function taka(value: unknown) {
  return \`Tk \${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\`;
}

function canonicalWebhookEvent(raw: string) {
  // The webhook's event field is the source of truth. Aliases only normalize
  // spelling/casing of the SAME event, never infer another delivery status.
  const normalized = String(raw || "unknown").trim().toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  const bare = normalized.startsWith("order.") ? normalized.slice(6) : normalized;
  return WEBHOOK_LABELS[normalized] ||
    WEBHOOK_LABELS["order." + bare] ||
    (raw.trim() || "Unknown Webhook Event");
}

function statusCardClass(label: string) {
  const value = label.toLowerCase();

  if (value.includes("return") || value.includes("cancel") ||
      value.includes("failed")) {
    return {
      card: "border-rose-100 bg-rose-50",
      label: "text-rose-700",
      value: "text-rose-800",
    };
  }

  if (value === "delivered") {
    return {
      card: "border-emerald-100 bg-emerald-50",
      label: "text-emerald-700",
      value: "text-emerald-800",
    };
  }

  if (
    value.includes("hub") ||
    value.includes("transit") ||
    value.includes("pickup") ||
    value.includes("sorting")
  ) {
    return {
      card: "border-blue-100 bg-blue-50",
      label: "text-blue-700",
      value: "text-blue-800",
    };
  }

  if (value.includes("hold") || value.includes("pending") || value.includes("await")) {
    return {
      card: "border-amber-100 bg-amber-50",
      label: "text-amber-700",
      value: "text-amber-800",
    };
  }

  return {
    card: "border-violet-100 bg-violet-50",
    label: "text-violet-700",
    value: "text-violet-800",
  };
}

export default async function PathaoDeliveryReportPage({
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;

  if (from > to) {
    [from, to] = [to, from];
  }

  const sourceId = String(params.source || "").trim();
  const courierId = String(params.courier || "").trim();
  const dateBasis = params.dateBasis === "webhook" ? "webhook" : "ready";
  const view = params.view === "history" ? "history" : "latest";
  const startUtc = bangladeshDateStartUtc(from);
  const endUtc = bangladeshDateEndUtc(to);
  const { prisma } = await import("@/lib/prisma");

  // Authenticate against the existing saved signatureValid flag. The table
  // includes rejected signatures, unmatched payloads and integration tests,
  // none of which may be used as verified product-delivery data.
  const [sources, couriers, webhooks] = await Promise.all([
    prisma.orderSource.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.courier.findMany({
      where: { status: true, pathaoEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.pathaoWebhookEvent.findMany({
      where: {
        signatureValid: true,
        processed: true,
        orderId: { not: null },
        ...(courierId ? { courierId } : {}),
        ...(dateBasis === "webhook"
          ? { receivedAt: { gte: startUtc, lte: endUtc } } : {}),
        order: {
          is: {
            ...(sourceId ? { sourceId } : {}),
            ...(dateBasis === "ready"
              ? { readyToShipAt: { gte: startUtc, lte: endUtc } } : {}),
            ...(dateBasis === "ready" && courierId
              ? { pathaoCourierId: courierId } : {}),
          },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      select: { id: true, orderId: true, eventName: true, receivedAt: true },
    }),
  ]);

  // In webhook-date mode, include only orders with a verified matching
  // event received inside the chosen date range. In RTS-date mode, include
  // submitted orders even if no webhook has reached OMS yet.
  const webhookOrderIds = Array.from(new Set(
    webhooks.map((event) => event.orderId).filter(
      (id): id is string => Boolean(id)
    )
  ));

  const [orders, unmatchedWebhookCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...(sourceId ? { sourceId } : {}),
        ...(dateBasis === "webhook"
          ? { id: { in: webhookOrderIds } }
          : {
              readyToShipAt: { gte: startUtc, lte: endUtc },
              ...(courierId ? { pathaoCourierId: courierId } : {}),
              OR: [
                { pathaoConsignmentId: { not: null } },
                { pathaoSubmittedAt: { not: null } },
                { pathaoWebhookEvents: {
                  some: { signatureValid: true, processed: true },
                } },
              ],
            }),
      },
      select: {
        id: true,
        totalAmount: true,
        deliveryCharge: true,
        pathaoDeliveryFee: true,
        source: {
          select: { id: true, name: true, type: true },
        },
        items: {
          select: {
            id: true,
            productSku: true,
            productName: true,
            quantity: true,
            product: {
              select: {
                sku: true,
                name: true,
                parent: { select: { sku: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ readyToShipAt: "desc" }, { createdAt: "desc" }],
    }),
    dateBasis === "webhook"
      ? prisma.pathaoWebhookEvent.count({
          where: {
            receivedAt: { gte: startUtc, lte: endUtc },
            signatureValid: true,
            orderId: null,
            ...(courierId ? { courierId } : {}),
          },
        })
      : Promise.resolve(0),
  ]);

  const latestWebhookByOrder = new Map<string, string>();
  const seenStagesByOrder = new Map<string, Set<string>>();
  // The webhook query is newest first. Record the latest actual event once,
  // and deduplicate repeated Pathao retries of the same order/event label.
  for (const event of webhooks) {
    if (!event.orderId) continue;
    const label = canonicalWebhookEvent(event.eventName);
    if (!latestWebhookByOrder.has(event.orderId)) {
      latestWebhookByOrder.set(event.orderId, label);
    }
    const stages = seenStagesByOrder.get(event.orderId) || new Set<string>();
    stages.add(label);
    seenStagesByOrder.set(event.orderId, stages);
  }

  const productStatusQuantity = new Map<string, number>();
  const orderStatusCount = new Map<string, number>();
  const extraStatuses = new Set<string>();

  type ProductReportRow = {
    key: string;
    parentCode: string;
    parentName: string;
    childSku: string;
    productName: string;
    sourceId: string;
    sourceName: string;
    sourceType: string;
    totalQty: number;
    statuses: Map<string, number>;
  };

  const productRowMap = new Map<string, ProductReportRow>();

  for (const order of orders) {
    // Latest mode: one event per OMS order, so products and money are never
    // multiplied by repeated webhook callbacks.
    // History mode: one occurrence of each status per order. A parcel can
    // appear in more than one stage, so stage quantities can exceed total qty.
    const statuses = view === "history"
      ? Array.from(seenStagesByOrder.get(order.id) || [])
      : [latestWebhookByOrder.get(order.id) || "No Verified Webhook"];
    if (!statuses.length) statuses.push("No Verified Webhook");

    for (const status of statuses) {
      orderStatusCount.set(status, (orderStatusCount.get(status) || 0) + 1);
      if (!PRIMARY_STATUS_COLUMNS.includes(status as (typeof PRIMARY_STATUS_COLUMNS)[number])) {
        extraStatuses.add(status);
      }
    }

    for (const item of order.items) {
      const quantity = Math.max(0, Number(item.quantity || 0));
      if (!quantity) continue;

      for (const status of statuses) {
        productStatusQuantity.set(
          status, (productStatusQuantity.get(status) || 0) + quantity
        );
      }

      const parentCode = item.product?.parent.sku || "UNLINKED";
      const parentName = item.product?.parent.name || "Product parent not linked";
      const childSku = item.product?.sku || item.productSku;
      const productName = item.product?.name || item.productName;
      const key = [parentCode, childSku, order.source.id].join("::");

      const row = productRowMap.get(key) || {
        key,
        parentCode,
        parentName,
        childSku,
        productName,
        sourceId: order.source.id,
        sourceName: order.source.name,
        sourceType: order.source.type,
        totalQty: 0,
        statuses: new Map<string, number>(),
      };

      // Count a purchased SKU once per order, not once per webhook event.
      row.totalQty += quantity;
      for (const status of statuses) {
        row.statuses.set(status, (row.statuses.get(status) || 0) + quantity);
      }
      productRowMap.set(key, row);
    }
  }

  const statusColumns = [
    ...PRIMARY_STATUS_COLUMNS,
    ...Array.from(extraStatuses).sort((a, b) => a.localeCompare(b)),
  ];

  const productRows = Array.from(productRowMap.values()).sort(
    (a, b) =>
      a.parentCode.localeCompare(b.parentCode) ||
      a.childSku.localeCompare(b.childSku) ||
      a.sourceName.localeCompare(b.sourceName)
  );

  const totalProductQty = productRows.reduce(
    (sum, row) => sum + row.totalQty,
    0
  );

  type ProductGroup = {
    key: string;
    parentCode: string;
    parentName: string;
    sourceId: string;
    sourceName: string;
    sourceType: string;
    totalQty: number;
    statuses: Map<string, number>;
    skuRows: {
      key: string;
      childSku: string;
      productName: string;
      totalQty: number;
      statuses: Record<string, number>;
    }[];
  };

  const productGroupMap = new Map<string, ProductGroup>();

  for (const row of productRows) {
    const groupKey = [row.parentCode, row.sourceId].join("::");
    const group =
      productGroupMap.get(groupKey) ||
      {
        key: groupKey,
        parentCode: row.parentCode,
        parentName: row.parentName,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceType: row.sourceType,
        totalQty: 0,
        statuses: new Map<string, number>(),
        skuRows: [],
      };

    group.totalQty += row.totalQty;

    for (const [status, qty] of row.statuses) {
      group.statuses.set(status, (group.statuses.get(status) || 0) + qty);
    }

    group.skuRows.push({
      key: row.key,
      childSku: row.childSku,
      productName: row.productName,
      totalQty: row.totalQty,
      statuses: Object.fromEntries(row.statuses),
    });

    productGroupMap.set(groupKey, group);
  }

  const productGroups = Array.from(productGroupMap.values())
    .map((group) => ({
      key: group.key,
      parentCode: group.parentCode,
      parentName: group.parentName,
      sourceName: group.sourceName,
      sourceType: group.sourceType,
      totalQty: group.totalQty,
      statuses: Object.fromEntries(group.statuses),
      skuRows: group.skuRows.sort((a, b) =>
        a.childSku.localeCompare(b.childSku)
      ),
    }))
    .sort(
      (a, b) =>
        b.totalQty - a.totalQty ||
        a.parentCode.localeCompare(b.parentCode) ||
        a.sourceName.localeCompare(b.sourceName)
    );

  const statusTotals = Object.fromEntries(
    statusColumns.map((status) => [
      status,
      productStatusQuantity.get(status) || 0,
    ])
  );

  const statusCounts = statusColumns.map((label) => ({
    label,
    count: productStatusQuantity.get(label) || 0,
    orders: orderStatusCount.get(label) || 0,
  }));
  const uniqueWebhookStages = Array.from(seenStagesByOrder.values())
    .reduce((total, labels) => total + labels.size, 0);

  const totalAmount = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0
  );
  const totalDeliveryCharge = orders.reduce(
    (sum, order) => sum + Number(order.deliveryCharge || 0),
    0
  );
  const totalPathaoFee = orders.reduce(
    (sum, order) => sum + Number(order.pathaoDeliveryFee || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Pathao Delivery Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Product delivery status from verified Pathao webhook events.
          Filter by Ready to Ship date or webhook received date, Source and courier.
          Current OMS status and Pathao API snapshots are not used for these event counts.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Source</span>
            <select
              name="source"
              defaultValue={sourceId}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Courier</span>
            <select
              name="courier"
              defaultValue={courierId}
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

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Date Basis</span>
            <select name="dateBasis" defaultValue={dateBasis}
              className="w-full rounded-xl border px-3 py-2.5 outline-none">
              <option value="ready">Ready to Ship date (shipment cohort)</option>
              <option value="webhook">Webhook received date (daily activity)</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Webhook Report View</span>
            <select name="view" defaultValue={view}
              className="w-full rounded-xl border px-3 py-2.5 outline-none">
              <option value="latest">Latest webhook per order</option>
              <option value="history">All webhook stages per order</option>
            </select>
          </label>

          <button className="self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Apply Filter
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-700">Pathao Orders</p>
          <p className="mt-2 text-3xl font-bold text-sky-900">{orders.length}</p>
          <p className="mt-1 text-xs text-sky-600">Unique OMS orders in selected filter</p>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-cyan-700">Product Qty</p>
          <p className="mt-2 text-3xl font-bold text-cyan-900">{totalProductQty}</p>
          <p className="mt-1 text-xs text-cyan-600">Unique order-item units; never summed per event</p>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-violet-700">Verified Webhook Events</p>
          <p className="mt-2 text-3xl font-bold text-violet-900">
            {webhooks.length.toLocaleString("en-BD")}
          </p>
          <p className="mt-1 text-xs text-violet-600">
            {uniqueWebhookStages.toLocaleString("en-BD")} unique order/status
            pair(s) · repeated callbacks counted once per status
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-indigo-700">Order Amount</p>
          <p className="mt-2 text-2xl font-bold text-indigo-900">
            {taka(totalAmount)}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-700">Delivery Charge</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {taka(totalDeliveryCharge)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Pathao Fee</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {taka(totalPathaoFee)}
          </p>
        </div>
      </section>

      {unmatchedWebhookCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {unmatchedWebhookCount} valid webhook event(s) received during
          this period could not be matched to an OMS order. These events
          cannot be assigned a product or source and are excluded from the
          delivery quantities. Check the merchant order ID / consignment mapping.
        </div>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {view === "latest"
              ? "Product Quantity by Latest Pathao Webhook"
              : "Product Quantity by Pathao Webhook Stage"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {view === "latest"
              ? "One last received, verified webhook per order. If no callback has arrived, the order is marked No Verified Webhook. Generic events such as Order Updated are shown as received; they are not inferred delivery outcomes."
              : "Each order contributes its product quantity once per distinct webhook stage. A parcel can pass through many stages, so status quantities must NOT be summed as unique product stock."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {dateBasis === "webhook"
              ? "Dates refer to when OMS received the webhook; latest means latest event within this selected period."
              : "Dates select orders by Ready to Ship date. Their entire verified webhook history up to now is used."}
            {" "}Store Created / Store Updated events are not order-level delivery statuses.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statusCounts.map((status) => {
            const colors = statusCardClass(status.label);
            return (
              <div
                key={status.label}
                className={`rounded-2xl border p-4 ${colors.card}`}
              >
                <p className={`text-sm font-medium ${colors.label}`}>
                  {status.label}
                </p>
                <p className={`mt-2 text-3xl font-bold ${colors.value}`}>
                  {status.count}
                </p>
                <p className={`mt-1 text-xs ${colors.label}`}>
                  {status.orders} order(s)
                </p>
              </div>
            );
          })}

          {!orders.length ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              No Pathao orders with reportable delivery data were found for the selected filters.
            </div>
          ) : null}
        </div>
      </section>

      <ProductDeliveryStatusTable
        groups={productGroups}
        statusColumns={statusColumns}
        statusTotals={statusTotals}
        totalProductQty={totalProductQty}
        dateLabel={`${from} to ${to} · ${dateBasis === "webhook" ? "Webhook received date" : "Ready to Ship date"}`}
        viewMode={view}
      />
    </div>
  );
}
