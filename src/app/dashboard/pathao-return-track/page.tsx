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

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
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

  const summary = logs.reduce(
    (sum, log) => ({
      totalReturns: sum.totalReturns + 1,
      fullReturns: sum.fullReturns + (log.returnType === "FULL" ? 1 : 0),
      partialReturns:
        sum.partialReturns + (log.returnType === "PARTIAL" ? 1 : 0),
      restoredQty: sum.restoredQty + log.totalRestoredQty,
    }),
    { totalReturns: 0, fullReturns: 0, partialReturns: 0, restoredQty: 0 }
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

      <PathaoReturnTrackClient
        filterDate={filterDate}
        summary={summary}
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
          })),
        }))}
      />
    </div>
  );
}
