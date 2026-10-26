import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";
import PastReturnHistoryClient from "./past-return-history-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PathaoPastReturnHistoryPage() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "MANAGER", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Load Prisma only at request time so Railway/Next build-time page collection
  // does not require DATABASE_URL.
  const { prisma } = await import("@/lib/prisma");

  const [passedRows, failedRows] = await Promise.all([
    prisma.pathaoReturnTrack.findMany({
      where: { processingMethod: "PAST_HISTORY_NO_STOCK" },
      include: {
        order: {
          select: {
            invoiceId: true,
            customerName: true,
            phone: true,
          },
        },
        pathaoCourier: { select: { name: true } },
        processedByUser: { select: { name: true, username: true } },
      },
      orderBy: { processedAt: "desc" },
      take: 500,
    }),
    prisma.pathaoUnmatchedReturnScan.findMany({
      where: { status: "PAST_HISTORY_FAILED" },
      orderBy: { lastScannedAt: "desc" },
      take: 500,
    }),
  ]);

  return (
    <PastReturnHistoryClient
      initialPassed={passedRows.map((row) => ({
        id: row.id,
        consignmentId: row.returnConsignmentId,
        outboundConsignmentId: row.outboundConsignmentId,
        invoiceId: row.order.invoiceId || row.merchantOrderId,
        customerName: row.order.customerName,
        phone: row.order.phone,
        courierName: row.pathaoCourier.name,
        processedBy:
          row.processedByUser.name ||
          row.processedByUser.username ||
          "OMS User",
        processedAt: formatBangladeshDateTime(row.processedAt),
      }))}
      initialFailed={failedRows.map((row) => ({
        id: row.id,
        consignmentId: row.consignmentId,
        merchantOrderId: row.matchedMerchantOrderId,
        reason: row.reason,
        lookupStatus: row.lookupStatus,
        checkedCourierCount: row.checkedCourierCount,
        failedCourierCount: row.failedCourierCount,
        scanCount: row.scanCount,
        lastScannedAt: formatBangladeshDateTime(row.lastScannedAt),
      }))}
    />
  );
}
