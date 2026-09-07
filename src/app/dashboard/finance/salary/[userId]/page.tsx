import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Banknote, CircleDollarSign, ReceiptText } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { formatBangladeshDate, getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import {
  calculateSalaryTotals,
  getSalaryMonthWithFallback,
  normalizeSalaryMonth,
  SALARY_TRANSACTION_LABELS,
} from "@/lib/finance/salary";
import { addSalaryTransactionAction, deleteSalaryTransactionAction } from "../../actions";
import ConfirmSubmitButton from "../../confirm-submit-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ month?: string }>;
};

function taka(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SalaryDetailsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Lazy-load Prisma only after the request reaches this dynamic page.
  // This prevents the MariaDB adapter from initializing during `next build`.
  const { prisma } = await import("@/lib/prisma");

  const { userId } = await params;
  const canManage = session.user.role === "ADMIN";
  if (!canManage && session.user.id !== userId) redirect("/dashboard/finance/my-salary");

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.salaryProfile.findUnique({ where: { userId } }),
  ]);
  if (!user) notFound();

  const paramValues = (await searchParams) || {};
  const defaultMonth = getBangladeshDateInputValue().slice(0, 7);
  let month = defaultMonth;
  try { month = normalizeSalaryMonth(paramValues.month || defaultMonth); } catch { month = defaultMonth; }

  const salaryMonth = await getSalaryMonthWithFallback(userId, month);
  const totals = salaryMonth
    ? calculateSalaryTotals({ baseSalary: salaryMonth.baseSalary, incrementAmount: salaryMonth.incrementAmount, transactions: salaryMonth.transactions })
    : calculateSalaryTotals({ baseSalary: 0, incrementAmount: 0, transactions: [] });

  const today = getBangladeshDateInputValue();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {canManage ? <Link href={`/dashboard/finance/salary?month=${month}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Salary Management</Link> : null}
            <h1 className="text-2xl font-bold text-slate-900">{canManage ? "Agent Salary Details" : "My Salary Report"}</h1>
            <p className="mt-1 text-sm text-slate-500">{user.name} · @{user.username} · {user.role}</p>
          </div>
          <form method="get" className="flex items-end gap-2"><label><span className="mb-1 block text-xs font-medium text-slate-500">Salary Month</span><input type="month" name="month" defaultValue={month} className="min-h-10 rounded-xl border px-3 text-sm" /></label><button className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">View</button></form>
        </div>
      </section>

      {!profile ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Salary has not been configured for this employee yet.</section> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Base Salary</p><p className="mt-2 text-xl font-bold">{taka(totals.baseSalary)}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Increment + Bonus</p><p className="mt-2 text-xl font-bold text-emerald-700">{taka(totals.increment + totals.bonus)}</p><p className="mt-1 text-xs text-slate-500">Increment {taka(totals.increment)} · Bonus {taka(totals.bonus)}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Salary Paid</p><p className="mt-2 text-xl font-bold text-blue-700">{taka(totals.salaryPaid)}</p><p className="mt-1 text-xs text-slate-500">Advance + partial + full</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Total Outstanding</p><p className="mt-2 text-xl font-bold text-amber-700">{taka(totals.totalOutstanding)}</p><p className="mt-1 text-xs text-slate-500">Salary {taka(totals.salaryBalance)} · Liability {taka(totals.liabilityBalance)}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-6">
        {[['Salary Due', totals.salaryDue], ['Advance', totals.advance], ['Fine', totals.fine], ['Liability Added', totals.liability], ['Liability Paid', totals.liabilityPaid], ['Liability Balance', totals.liabilityBalance]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{String(label)}</p><p className="mt-1 font-bold text-slate-900">{taka(value)}</p></div>)}
      </section>

      {canManage && profile?.enabled ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><CircleDollarSign className="h-5 w-5" /><div><h2 className="font-bold">Add Monthly Adjustment</h2><p className="text-sm text-slate-500">Bonus and liability add to payable; fine deducts from salary.</p></div></div>
            <form action={addSalaryTransactionAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="userId" value={userId} /><input type="hidden" name="month" value={month} />
              <label><span className="mb-1 block text-sm font-medium">Type</span><select name="type" className="min-h-11 w-full rounded-xl border px-3 text-sm"><option value="BONUS">Bonus</option><option value="LIABILITY_ADD">Liability / Other Payable</option><option value="FINE">Fine</option></select></label>
              <label><span className="mb-1 block text-sm font-medium">Amount</span><input name="amount" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
              <label><span className="mb-1 block text-sm font-medium">Date</span><input name="transactionDate" type="date" defaultValue={today} required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
              <label><span className="mb-1 block text-sm font-medium">Note</span><input name="note" className="min-h-11 w-full rounded-xl border px-3 text-sm" placeholder="Optional note" /></label>
              <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white sm:col-span-2">Add Adjustment</button>
            </form>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Banknote className="h-5 w-5" /><div><h2 className="font-bold">Pay Agent</h2><p className="text-sm text-slate-500">Record advance salary, partial salary, full balance or liability payment.</p></div></div>
            <form action={addSalaryTransactionAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="userId" value={userId} /><input type="hidden" name="month" value={month} />
              <label><span className="mb-1 block text-sm font-medium">Payment Type</span><select name="type" className="min-h-11 w-full rounded-xl border px-3 text-sm"><option value="ADVANCE_SALARY">Advance Salary</option><option value="PARTIAL_SALARY">Partial Salary</option><option value="LIABILITY_PAYMENT">Pay Liability</option></select></label>
              <label><span className="mb-1 block text-sm font-medium">Amount</span><input name="amount" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
              <label><span className="mb-1 block text-sm font-medium">Date</span><input name="transactionDate" type="date" defaultValue={today} required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
              <label><span className="mb-1 block text-sm font-medium">Note</span><input name="note" className="min-h-11 w-full rounded-xl border px-3 text-sm" placeholder="Optional note" /></label>
              <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white sm:col-span-2">Record Payment</button>
            </form>
            <form action={addSalaryTransactionAction} className="mt-3">
              <input type="hidden" name="userId" value={userId} /><input type="hidden" name="month" value={month} /><input type="hidden" name="type" value="FULL_SALARY" /><input type="hidden" name="amount" value="0" /><input type="hidden" name="transactionDate" value={today} /><input type="hidden" name="note" value="Full remaining monthly salary paid" />
              <button disabled={totals.salaryBalance <= 0} className="min-h-11 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">Pay Full Remaining Salary ({taka(totals.salaryBalance)})</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b p-5"><ReceiptText className="h-5 w-5 text-slate-600" /><div><h2 className="font-bold">Monthly Salary Ledger</h2><p className="text-sm text-slate-500">Every bonus, fine, liability and payment is listed here.</p></div></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Note</th><th className="px-5 py-3">Entered By</th>{canManage ? <th className="px-5 py-3">Action</th> : null}</tr></thead><tbody>
          {salaryMonth?.transactions.map((transaction) => <tr key={transaction.id} className="border-t"><td className="px-5 py-3 whitespace-nowrap">{formatBangladeshDate(transaction.transactionDate)}</td><td className="px-5 py-3 font-semibold">{SALARY_TRANSACTION_LABELS[transaction.type]}</td><td className="px-5 py-3 font-bold">{taka(transaction.amount)}</td><td className="max-w-md px-5 py-3 text-slate-600">{transaction.note || "-"}</td><td className="px-5 py-3">{transaction.createdByUser?.name || "Admin"}</td>{canManage ? <td className="px-5 py-3"><form action={deleteSalaryTransactionAction}><input type="hidden" name="id" value={transaction.id} /><input type="hidden" name="userId" value={userId} /><ConfirmSubmitButton message="Delete this salary transaction? The monthly totals will be recalculated." className="rounded-lg border px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete</ConfirmSubmitButton></form></td> : null}</tr>)}
          {!salaryMonth?.transactions.length ? <tr><td colSpan={canManage ? 6 : 5} className="px-5 py-10 text-center text-slate-500">No salary transactions for {month}.</td></tr> : null}
        </tbody></table></div>
      </section>
    </div>
  );
}
