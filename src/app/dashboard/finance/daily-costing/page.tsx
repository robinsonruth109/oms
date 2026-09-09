import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, ReceiptText, Trash2 } from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  getBangladeshDateInputValue,
  getBangladeshDayRange,
} from "@/lib/bangladesh-time";
import {
  calculateDailyCashBook,
  DAILY_EXPENSE_TYPES,
  DAILY_PAYMENT_METHODS,
} from "@/lib/finance/daily-cash";
import { createDailyCostAction, deleteDailyCostAction } from "../actions";
import ConfirmSubmitButton from "../confirm-submit-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

function taka(value: unknown) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  return `${sign}Tk ${Math.abs(amount).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function entryDetails(entry: { note: string | null; description: string }) {
  return entry.note || entry.description || "-";
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

  const [entries, priorEntries] = await Promise.all([
    prisma.financeDailyCost.findMany({
      where: { costDate: { gte: range.start, lte: range.end } },
      include: {
        createdByUser: { select: { name: true, username: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.financeDailyCost.findMany({
      where: { costDate: { lt: range.start } },
      select: { entryType: true, amount: true, paymentMethod: true },
      orderBy: [{ costDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const totals = calculateDailyCashBook(priorEntries, entries);
  const jomaEntries = entries.filter((entry) => entry.entryType === "JOMA");
  const khorochEntries = entries.filter((entry) => entry.entryType !== "JOMA");
  const methodNames = Object.keys(totals.byMethod).filter((method) => {
    const balance = totals.byMethod[method];
    return DAILY_PAYMENT_METHODS.includes(method as (typeof DAILY_PAYMENT_METHODS)[number]) || balance.opening !== 0 || balance.joma !== 0 || balance.khoroch !== 0 || balance.closing !== 0;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Costing</h1>
            <p className="mt-1 text-sm text-slate-500">
              Daily Joma/Khoroch cash book with yesterday&apos;s lasting balance and Cash, Bank and bKash tracking.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Existing Balance</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{taka(totals.openingBalance)}</p>
          <p className="mt-1 text-xs text-slate-400">Yesterday&apos;s lasting balance</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today Joma</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">+ {taka(totals.totalJoma)}</p>
          <p className="mt-1 text-xs text-slate-400">Today&apos;s cash in</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today Khoroch</p>
          <p className="mt-2 text-xl font-bold text-rose-600">- {taka(totals.totalKhoroch)}</p>
          <p className="mt-1 text-xs text-slate-400">Today&apos;s total cash out</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today Lasting Balance</p>
          <p className={`mt-2 text-xl font-bold ${totals.closingBalance < 0 ? "text-rose-600" : "text-slate-900"}`}>
            {taka(totals.closingBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Existing + Joma - Khoroch</p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-slate-900">Method Balance</h2>
          <p className="text-sm text-slate-500">See exactly where today&apos;s balance is held.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {methodNames.map((method) => {
            const balance = totals.byMethod[method];
            return (
              <div key={method} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">{method}</p>
                  <p className={`font-bold ${balance.closing < 0 ? "text-rose-600" : "text-slate-900"}`}>{taka(balance.closing)}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div><span className="block">Opening</span><strong className="text-slate-700">{taka(balance.opening)}</strong></div>
                  <div><span className="block">Joma</span><strong className="text-emerald-600">{taka(balance.joma)}</strong></div>
                  <div><span className="block">Khoroch</span><strong className="text-rose-600">{taka(balance.khoroch)}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-slate-900">Joma / Cash In</h2>
              <p className="text-sm text-slate-500">Add money received today.</p>
            </div>
          </div>
          <form action={createDailyCostAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="entryType" value="JOMA" />
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
              <input name="costDate" type="date" defaultValue={date} required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Method</span>
              <select name="paymentMethod" defaultValue="Cash" required className="min-h-11 w-full rounded-xl border px-3 text-sm">
                {DAILY_PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Amount (Tk)</span>
              <input name="amount" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Details / Note</span>
              <input name="details" placeholder="Where did the money come from?" className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 sm:col-span-2">
              Add Joma
            </button>
          </form>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-900">Khoroch / Cash Out</h2>
              <p className="text-sm text-slate-500">Record an expense with type, note, amount and method.</p>
            </div>
          </div>
          <form action={createDailyCostAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="entryType" value="KHOROCH" />
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
              <input name="costDate" type="date" defaultValue={date} required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Expense Type</span>
              <select name="category" defaultValue="" required className="min-h-11 w-full rounded-xl border px-3 text-sm">
                <option value="" disabled>Select expense type</option>
                {DAILY_EXPENSE_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Amount (Tk)</span>
              <input name="amount" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Method</span>
              <select name="paymentMethod" defaultValue="Cash" required className="min-h-11 w-full rounded-xl border px-3 text-sm">
                {DAILY_PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Note / Details</span>
              <input name="details" placeholder="What was this expense for?" required className="min-h-11 w-full rounded-xl border px-3 text-sm" />
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:col-span-2">
              Add Khoroch
            </button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="font-bold text-slate-900">Daily Cash Book</h2>
              <p className="text-sm text-slate-500">Joma and Khoroch for one Bangladesh business date.</p>
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

        <div className="border-b p-5">
          <h3 className="mb-3 font-bold text-emerald-700">Today Cash In / Joma</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Details</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Entered By</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {jomaEntries.map((entry) => (
                  <tr key={entry.id} className="border-t align-top">
                    <td className="max-w-lg px-4 py-3 text-slate-700">{entryDetails(entry)}</td>
                    <td className="px-4 py-3 font-medium">{entry.paymentMethod || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-emerald-700">{taka(entry.amount)}</td>
                    <td className="px-4 py-3">{entry.createdByUser.name}<div className="text-xs text-slate-400">@{entry.createdByUser.username}</div></td>
                    <td className="px-4 py-3">
                      <form action={deleteDailyCostAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <ConfirmSubmitButton title="Delete Joma entry" message="Delete this Joma entry? The daily balance will be recalculated." className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {jomaEntries.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No Joma entries for this date.</td></tr> : null}
              </tbody>
              {jomaEntries.length ? <tfoot className="border-t-2 bg-emerald-50"><tr><td colSpan={2} className="px-4 py-3 text-right font-bold">Total Joma</td><td className="px-4 py-3 font-bold text-emerald-700">{taka(totals.totalJoma)}</td><td colSpan={2} /></tr></tfoot> : null}
            </table>
          </div>
        </div>

        <div className="p-5">
          <h3 className="mb-3 font-bold text-rose-700">Today Khoroch</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Expense Type</th><th className="px-4 py-3">Note</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Entered By</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {khorochEntries.map((entry) => (
                  <tr key={entry.id} className="border-t align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900">{entry.category}</td>
                    <td className="max-w-lg px-4 py-3 text-slate-700">{entryDetails(entry)}</td>
                    <td className="px-4 py-3 font-medium">{entry.paymentMethod || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-rose-700">{taka(entry.amount)}</td>
                    <td className="px-4 py-3">{entry.createdByUser.name}<div className="text-xs text-slate-400">@{entry.createdByUser.username}</div></td>
                    <td className="px-4 py-3">
                      <form action={deleteDailyCostAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <ConfirmSubmitButton title="Delete Khoroch entry" message="Delete this Khoroch entry? The daily balance will be recalculated." className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {khorochEntries.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No Khoroch entries for this date.</td></tr> : null}
              </tbody>
              {khorochEntries.length ? <tfoot className="border-t-2 bg-rose-50"><tr><td colSpan={3} className="px-4 py-3 text-right font-bold">Total Khoroch</td><td className="px-4 py-3 font-bold text-rose-700">{taka(totals.totalKhoroch)}</td><td colSpan={2} /></tr></tfoot> : null}
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
