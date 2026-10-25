import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import SettlementUpload from "./settlement-upload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    courierId?: string;
  }>;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function taka(value: number) {
  return (
    "Tk " +
    Number(value || 0).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default async function PathaoPaymentSettlementPage({
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  const from = validDate(String(params.from || ""))
    ? String(params.from)
    : today;
  const to = validDate(String(params.to || "")) ? String(params.to) : today;
  const courierId = String(params.courierId || "").trim();

  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);
  const { prisma } = await import("@/lib/prisma");

  const [couriers, uploads] = await Promise.all([
    prisma.courier.findMany({
      where: { status: true, pathaoEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pathaoSettlementUpload.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(courierId ? { courierId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        courierId: true,
        courierName: true,
        rowCount: true,
        matchedCount: true,
        unmatchedCount: true,
        duplicateCount: true,
        createdAt: true,
      },
    }),
  ]);

  const uploadIds = uploads.map((row) => row.id);
  const settlements = uploadIds.length
    ? await prisma.pathaoSettlement.findMany({
        where: { uploadId: { in: uploadIds } },
        select: {
          orderId: true,
          collectedAmount: true,
          deliveryFee: true,
          codFee: true,
          totalFee: true,
        },
      })
    : [];

  const verifiedRows = settlements.filter((row) => Boolean(row.orderId));
  const totalRows = uploads.reduce((sum, row) => sum + row.rowCount, 0);
  const totalMatched = uploads.reduce((sum, row) => sum + row.matchedCount, 0);
  const totalUnmatched = uploads.reduce(
    (sum, row) => sum + row.unmatchedCount,
    0
  );
  const collectedTotal = verifiedRows.reduce(
    (sum, row) => sum + Number(row.collectedAmount || 0),
    0
  );
  const deliveryFeeTotal = verifiedRows.reduce(
    (sum, row) => sum + Number(row.deliveryFee || 0),
    0
  );
  const codFeeTotal = verifiedRows.reduce(
    (sum, row) => sum + Number(row.codFee || 0),
    0
  );
  const totalFee = verifiedRows.reduce(
    (sum, row) => sum + Number(row.totalFee || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pathao Payment Settlement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Daily Pathao payment verification. CSV is the accounting source of
              truth; webhook is status tracking only.
            </p>
          </div>
        </div>
      </section>

      <SettlementUpload couriers={couriers} />

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.3fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Pathao Account</span>
            <select
              name="courierId"
              defaultValue={courierId}
              className="w-full rounded-xl border px-3 py-2.5"
            >
              <option value="">All Pathao Accounts</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name}
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Apply Filter
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Payment Files" value={String(uploads.length)} />
        <Card label="CSV Rows" value={String(totalRows)} />
        <Card label="Payment Done" value={String(totalMatched)} tone="green" />
        <Card
          label="Unmatched"
          value={String(totalUnmatched)}
          tone={totalUnmatched ? "red" : "green"}
        />
        <Card label="Collected Amount" value={taka(collectedTotal)} />
        <Card label="Delivery Fee" value={taka(deliveryFeeTotal)} />
        <Card label="COD Fee" value={taka(codFeeTotal)} />
        <Card label="Total Pathao Fee" value={taka(totalFee)} />
      </section>

      {totalUnmatched > 0 ? (
        <section className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {totalUnmatched} CSV row(s) in this date range are not linked to an
            OMS order yet. They are not marked PAYMENT DONE and are excluded from
            verified Profit Margin accounting.
          </p>
        </section>
      ) : uploads.length ? (
        <section className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>All CSV rows in this filtered settlement history are matched.</p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Payment Upload History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Filtered by upload date. Re-uploading a payment file safely refreshes
            the exact verified amounts on matched OMS orders.
          </p>
        </div>

        {uploads.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3">Pathao Account</th>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3 text-right">Rows</th>
                  <th className="px-5 py-3 text-right">Payment Done</th>
                  <th className="px-5 py-3 text-right">Unmatched</th>
                  <th className="px-5 py-3 text-right">Updated Existing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploads.map((upload) => (
                  <tr key={upload.id}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {upload.createdAt.toLocaleString("en-BD", {
                        timeZone: "Asia/Dhaka",
                      })}
                    </td>
                    <td className="px-5 py-4 font-medium">
                      {upload.courierName || "Legacy upload"}
                    </td>
                    <td className="px-5 py-4">{upload.fileName}</td>
                    <td className="px-5 py-4 text-right">{upload.rowCount}</td>
                    <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                      {upload.matchedCount}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-rose-700">
                      {upload.unmatchedCount}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {upload.duplicateCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No Pathao payment file was uploaded in this date range.
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50"
      : tone === "red"
        ? "border-rose-100 bg-rose-50"
        : "bg-white";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
