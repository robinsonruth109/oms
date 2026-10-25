import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import PathaoReturnTrackClient from "./pathao-return-track-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

function safeDate(value: string | undefined, fallback: string) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

export default async function PathaoReturnTrackPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "MANAGER", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  const filterDate = safeDate(params.date, today);
  const { prisma } = await import("@/lib/prisma");

  const logs = await prisma.pathaoReturnTrack.findMany({
    where: {
      processedAt: {
        gte: bangladeshDateStartUtc(filterDate),
        lte: bangladeshDateEndUtc(filterDate),
      },
    },
    include: {
      order: {
        select: {
          invoiceId: true,
          customerName: true,
          phone: true,
        },
      },
      pathaoCourier: {
        select: { name: true },
      },
      processedByUser: {
        select: { name: true, username: true },
      },
      items: {
        select: {
          productSkuSnapshot: true,
          productNameSnapshot: true,
          returnedQty: true,
        },
      },
    },
    orderBy: { processedAt: "desc" },
    take: 2000,
  });

  const unmatched = await prisma.pathaoUnmatchedReturnScan.findMany({
    where: {
      OR: [
        {
          firstScannedAt: {
            gte: bangladeshDateStartUtc(filterDate),
            lte: bangladeshDateEndUtc(filterDate),
          },
        },
        {
          lastScannedAt: {
            gte: bangladeshDateStartUtc(filterDate),
            lte: bangladeshDateEndUtc(filterDate),
          },
        },
      ],
    },
    orderBy: { lastScannedAt: "desc" },
    take: 2000,
  });

  // Cross-match Pathao payment-return rows with physically received returns.
  // Mismatches remain visible across dates until the opposite side arrives.
  const [allReturnTracks, settlementCandidates] = await Promise.all([
    prisma.pathaoReturnTrack.findMany({
      select: {
        orderId: true,
        returnConsignmentId: true,
        processedAt: true,
      },
      orderBy: { processedAt: "desc" },
      take: 5000,
    }),
    prisma.pathaoSettlement.findMany({
      where: { orderId: { not: null } },
      select: {
        orderId: true,
        consignmentId: true,
        orderStatus: true,
        paymentStatus: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
  ]);

  const returnPaymentRows = settlementCandidates.filter((row) => {
    const statusText = `${row.orderStatus || ""} ${row.paymentStatus || ""}`
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    return statusText.includes("return");
  });

  const physicalByOrder = new Map<string, typeof allReturnTracks>();
  for (const row of allReturnTracks) {
    const list = physicalByOrder.get(row.orderId) || [];
    list.push(row);
    physicalByOrder.set(row.orderId, list);
  }

  const paymentByOrder = new Map<string, typeof returnPaymentRows>();
  for (const row of returnPaymentRows) {
    if (!row.orderId) continue;
    const list = paymentByOrder.get(row.orderId) || [];
    list.push(row);
    paymentByOrder.set(row.orderId, list);
  }

  const reconciliationOrderIds = Array.from(
    new Set([...physicalByOrder.keys(), ...paymentByOrder.keys()])
  );

  const reconciliationOrders = reconciliationOrderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: reconciliationOrderIds } },
        select: {
          id: true,
          invoiceId: true,
          pathaoConsignmentId: true,
          customerName: true,
          phone: true,
        },
      })
    : [];

  const reconciliationOrderMap = new Map(
    reconciliationOrders.map((order) => [order.id, order])
  );
  const selectedStart = bangladeshDateStartUtc(filterDate).getTime();
  const selectedEnd = bangladeshDateEndUtc(filterDate).getTime();

  const returnReconciliation = reconciliationOrderIds
    .map((orderId) => {
      const physical = physicalByOrder.get(orderId) || [];
      const payment = paymentByOrder.get(orderId) || [];
      const order = reconciliationOrderMap.get(orderId);
      if (!order) return null;

      const matched = physical.length > 0 && payment.length > 0;
      const touchedSelectedDate =
        physical.some((row) => {
          const time = row.processedAt.getTime();
          return time >= selectedStart && time <= selectedEnd;
        }) ||
        payment.some((row) => {
          const time = row.updatedAt.getTime();
          return time >= selectedStart && time <= selectedEnd;
        });

      // Keep every unresolved mismatch visible until reconciled. Matched rows
      // are shown when either side was updated/scanned on the selected date.
      if (matched && !touchedSelectedDate) return null;

      const status =
        matched
          ? "MATCHED"
          : payment.length
            ? "PAYMENT_FIRST"
            : "PHYSICAL_FIRST";

      return {
        orderId,
        invoiceId: order.invoiceId || orderId,
        customerName: order.customerName,
        phone: order.phone,
        outboundConsignmentId: order.pathaoConsignmentId || "N/A",
        paymentReturnIds: payment.map((row) => row.consignmentId),
        physicalReturnIds: physical.map((row) => row.returnConsignmentId),
        status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const rank = (value: string) =>
        value === "PAYMENT_FIRST" ? 0 : value === "PHYSICAL_FIRST" ? 1 : 2;
      return rank(a.status) - rank(b.status);
    });

  const summary = logs.reduce(
    (sum, log) => ({
      totalReturns: sum.totalReturns + 1,
      fullReturns: sum.fullReturns + (log.returnType === "FULL" ? 1 : 0),
      partialReturns:
        sum.partialReturns + (log.returnType === "PARTIAL" ? 1 : 0),
      restoredQty: sum.restoredQty + log.totalRestoredQty,
      zeroRestoredReturns:
        sum.zeroRestoredReturns + (log.totalRestoredQty <= 0 ? 1 : 0),
    }),
    {
      totalReturns: 0,
      fullReturns: 0,
      partialReturns: 0,
      restoredQty: 0,
      zeroRestoredReturns: 0,
    }
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Pathao Return Track</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan a Pathao return consignment, match its merchant order ID to the OMS invoice,
          process full or partial returns, and restore the exact returned product quantity.
        </p>
      </section>

      {returnReconciliation.length ? (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Return Payment ↔ Physical Parcel Cross-Match
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Unresolved mismatches remain visible until both the Pathao payment CSV return row
                  and the physical Return Track scan exist for the same OMS order.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">
                  Payment First {returnReconciliation.filter((row) => row.status === "PAYMENT_FIRST").length}
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                  Physical First {returnReconciliation.filter((row) => row.status === "PHYSICAL_FIRST").length}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                  Matched {returnReconciliation.filter((row) => row.status === "MATCHED").length}
                </span>
              </div>
            </div>
          </div>
          <div className="max-h-[460px] overflow-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">OMS Invoice</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Outbound CID</th>
                  <th className="px-5 py-3">Payment Return CID</th>
                  <th className="px-5 py-3">Physical Return CID</th>
                  <th className="px-5 py-3">Cross-Match</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {returnReconciliation.map((row) => {
                  const tone =
                    row.status === "MATCHED"
                      ? "bg-emerald-100 text-emerald-800"
                      : row.status === "PAYMENT_FIRST"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800";
                  const label =
                    row.status === "MATCHED"
                      ? "Matched"
                      : row.status === "PAYMENT_FIRST"
                        ? "Payment First · Parcel Not Received"
                        : "Physical First · Payment Not Received";
                  return (
                    <tr key={row.orderId}>
                      <td className="px-5 py-3 font-semibold">{row.invoiceId}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.customerName}</p>
                        <p className="text-xs text-slate-500">{row.phone}</p>
                      </td>
                      <td className="px-5 py-3">{row.outboundConsignmentId}</td>
                      <td className="px-5 py-3">
                        {row.paymentReturnIds.length ? row.paymentReturnIds.join(", ") : "Not received"}
                      </td>
                      <td className="px-5 py-3">
                        {row.physicalReturnIds.length ? row.physicalReturnIds.join(", ") : "Not scanned"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          No pending Pathao return/payment cross-match issue.
        </section>
      )}

      <PathaoReturnTrackClient
        filterDate={filterDate}
        canDeleteUnmatched={["ADMIN", "MANAGER"].includes(session.user.role)}
        summary={summary}
        unmatchedRows={unmatched.map((scan) => ({
          id: scan.id,
          consignmentId: scan.consignmentId,
          status: scan.status,
          lookupStatus: scan.lookupStatus,
          reason: scan.reason,
          matchedMerchantOrderId: scan.matchedMerchantOrderId,
          checkedCourierCount: scan.checkedCourierCount,
          failedCourierCount: scan.failedCourierCount,
          scanCount: scan.scanCount,
          scannedBy: scan.scannedByName,
          firstScannedAt: formatBangladeshDateTime(scan.firstScannedAt),
          lastScannedAt: formatBangladeshDateTime(scan.lastScannedAt),
          resolvedAt: scan.resolvedAt
            ? formatBangladeshDateTime(scan.resolvedAt)
            : null,
        }))}
        rows={logs.map((log) => ({
          id: log.id,
          returnConsignmentId: log.returnConsignmentId,
          outboundConsignmentId: log.outboundConsignmentId,
          invoiceId: log.order.invoiceId || log.merchantOrderId,
          customerName: log.order.customerName,
          phone: log.order.phone,
          omsStatus: log.newOmsStatus,
          previousOmsStatus: log.previousOmsStatus,
          pathaoStatus: log.pathaoOrderStatus,
          pathaoStatusSlug: log.pathaoOrderStatusSlug,
          courierName: log.pathaoCourier.name,
          returnType: log.returnType,
          totalRestoredQty: log.totalRestoredQty,
          processedBy:
            log.processedByUser.name || log.processedByUser.username || "OMS User",
          processedAt: formatBangladeshDateTime(log.processedAt),
          items: log.items.map((item) => ({
            sku: item.productSkuSnapshot,
            name: item.productNameSnapshot,
            quantity: item.returnedQty,
            stockBreakdown: item.stockBreakdown,
          })),
        }))}
      />
    </div>
  );
}
