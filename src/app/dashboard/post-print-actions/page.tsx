import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  BulkCancelCsvForm,
  BulkStockOutCsvForm,
  SingleCancelForm,
  SingleStockOutForm,
} from "./forms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ date?: string; action?: string }>;
};

export default async function PostPrintActionsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const date = String(params.date || getBangladeshDateInputValue()).trim();
  const action = String(params.action || "").trim();

  const logs = await prisma.postPrintActionLog.findMany({
    where: {
      createdAt: {
        gte: bangladeshDateStartUtc(date),
        lte: bangladeshDateEndUtc(date),
      },
      ...(action === "STOCK_OUT" || action === "CANCELLED"
        ? { actionType: action }
        : {}),
    },
    include: {
      performedByUser: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Post Print Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mark orders as stock out/cancelled and keep a permanent daily action log.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SingleStockOutForm />
        <SingleCancelForm />
        <BulkStockOutCsvForm />
        <BulkCancelCsvForm />
      </div>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Daily Stock Out / Cancel Log</h2>
              <p className="mt-1 text-sm text-slate-500">
                Bangladesh time. Shows who changed each invoice and whether it was a single or CSV action.
              </p>
            </div>

            <form className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Date</span>
                <input name="date" type="date" defaultValue={date} className="rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Action</span>
                <select name="action" defaultValue={action} className="rounded-xl border px-3 py-2">
                  <option value="">All</option>
                  <option value="STOCK_OUT">Stock Out</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <button className="self-end rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white">
                Filter
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">By</th>
                <th className="px-5 py-3">Previous</th>
                <th className="px-5 py-3">New</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-5 py-3">{formatBangladeshDateTime(log.createdAt)}</td>
                  <td className="px-5 py-3 font-semibold">{log.invoiceId || "N/A"}</td>
                  <td className="px-5 py-3">
                    <p>{log.customerName}</p>
                    <p className="text-xs text-slate-500">{log.phone}</p>
                  </td>
                  <td className={`px-5 py-3 font-semibold ${log.actionType === "CANCELLED" ? "text-red-600" : "text-violet-600"}`}>
                    {log.actionType}
                  </td>
                  <td className="px-5 py-3">{log.actionMethod}</td>
                  <td className="px-5 py-3">{log.performedByUser.name}</td>
                  <td className="px-5 py-3">{log.previousStatus}</td>
                  <td className="px-5 py-3">{log.newStatus}</td>
                </tr>
              ))}
              {!logs.length ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No actions for this date.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
