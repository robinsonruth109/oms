import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, ReceiptText, Trash2 } from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  getBangladeshDateInputValue,
  getBangladeshDayRange,
} from "@/lib/bangladesh-time";
import { createDailyCostAction, deleteDailyCostAction } from "../actions";
import ConfirmSubmitButton from "../confirm-submit-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

function taka(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DailyCostingPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  // Lazy-load Prisma only after the request reaches this dynamic page.
  // This prevents the MariaDB adapter from initializing during `next build`.
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const date = String(params.date || getBangladeshDateInputValue()).trim();
  const range = getBangladeshDayRange(date);

  const costs = await prisma.financeDailyCost.findMany({
    where: { costDate: { gte: range.start, lte: range.end } },
    include: {
      createdByUser: { select: { name: true, username: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const total = costs.reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Costing</h1>
            <p className="mt-1 text-sm text-slate-500">
              Record office expenses by Bangladesh business date and download the daily cost report as PDF.
            </p>
          </div>
          <Link
            href={`/api/finance/daily-costing/pdf?date=${encodeURIComponent(date)}`}
            target="_blank"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Download Daily PDF
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected Date</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{date}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Entries</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{costs.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Cost</p>
          <p className="mt-2 text-xl font-bold text-rose-600">{taka(total)}</p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Plus className="h-5 w-5 text-slate-600" />
          <div>
            <h2 className="font-bold text-slate-900">Add Cost Entry</h2>
            <p className="text-sm text-slate-500">Every entry keeps the admin user and creation time for audit.</p>
          </div>
        </div>

        <form action={createDailyCostAction} className="grid gap-4 lg:grid-cols-12">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
            <input name="costDate" type="date" defaultValue={date} required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
            <input name="category" list="cost-categories" placeholder="Office / Transport" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            <datalist id="cost-categories">
              <option value="Office" /><option value="Transport" /><option value="Food" /><option value="Utility" />
              <option value="Packaging" /><option value="Courier" /><option value="Marketing" /><option value="Maintenance" /><option value="Miscellaneous" />
            </datalist>
          </label>
          <label className="lg:col-span-3">
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <input name="description" placeholder="What was this cost for?" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Amount (Tk)</span>
            <input name="amount" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Payment Method</span>
            <select name="paymentMethod" defaultValue="Cash" className="min-h-11 w-full rounded-xl border px-3 text-sm">
              <option>Cash</option><option>Bank</option><option>bKash</option><option>Nagad</option><option>Card</option><option>Other</option>
            </select>
          </label>
          <div className="flex items-end lg:col-span-1">
            <button type="submit" className="min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">Add</button>
          </div>
          <label className="lg:col-span-12">
            <span className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</span>
            <input name="note" placeholder="Optional note" className="min-h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="font-bold text-slate-900">Daily Cost Report</h2>
              <p className="text-sm text-slate-500">Filter one Bangladesh business date.</p>
            </div>
          </div>
          <form className="flex items-end gap-2" method="get">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
              <input type="date" name="date" defaultValue={date} className="min-h-10 rounded-xl border px-3 text-sm" />
            </label>
            <button className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Filter</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Category</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Amount</th><th className="px-5 py-3">Note</th><th className="px-5 py-3">Entered By</th><th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.id} className="border-t align-top">
                  <td className="px-5 py-3 font-semibold text-slate-900">{cost.category}</td>
                  <td className="max-w-sm px-5 py-3 text-slate-700">{cost.description}</td>
                  <td className="px-5 py-3">{cost.paymentMethod || "-"}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-bold">{taka(cost.amount)}</td>
                  <td className="max-w-xs px-5 py-3 text-slate-500">{cost.note || "-"}</td>
                  <td className="px-5 py-3">{cost.createdByUser.name}<div className="text-xs text-slate-400">@{cost.createdByUser.username}</div></td>
                  <td className="px-5 py-3">
                    <form action={deleteDailyCostAction}>
                      <input type="hidden" name="id" value={cost.id} />
                      <ConfirmSubmitButton title="Delete cost entry" message="Delete this daily cost entry?" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {costs.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">No cost entries for this date.</td></tr> : null}
            </tbody>
            {costs.length ? <tfoot className="border-t-2 bg-slate-50"><tr><td colSpan={3} className="px-5 py-4 text-right font-bold">Daily Total</td><td className="px-5 py-4 font-bold text-rose-600">{taka(total)}</td><td colSpan={3} /></tr></tfoot> : null}
          </table>
        </div>
      </section>
    </div>
  );
}
