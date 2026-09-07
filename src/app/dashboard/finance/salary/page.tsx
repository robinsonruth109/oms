import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Eye, UserRoundCog, WalletCards } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import {
  calculateSalaryTotals,
  getSalaryMonthWithFallback,
  normalizeSalaryMonth,
} from "@/lib/finance/salary";
import { saveSalaryProfileAction, toggleSalaryProfileAction } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams?: Promise<{ month?: string }> };

function taka(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SalaryManagementPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  // Lazy-load Prisma only after the request reaches this dynamic page.
  // This prevents the MariaDB adapter from initializing during `next build`.
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const defaultMonth = getBangladeshDateInputValue().slice(0, 7);
  let month = defaultMonth;
  try { month = normalizeSalaryMonth(params.month || defaultMonth); } catch { month = defaultMonth; }

  const [agents, profiles] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["AGENT", "NOTE_AGENT", "PACKAGING_AGENT"] }, status: true },
      orderBy: [{ name: "asc" }],
    }),
    prisma.salaryProfile.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const rows = await Promise.all(profiles.map(async (profile) => {
    const salaryMonth = await getSalaryMonthWithFallback(profile.userId, month);
    const totals = salaryMonth ? calculateSalaryTotals({
      baseSalary: salaryMonth.baseSalary,
      incrementAmount: salaryMonth.incrementAmount,
      transactions: salaryMonth.transactions,
    }) : calculateSalaryTotals({ baseSalary: profile.baseSalary, incrementAmount: profile.incrementAmount, transactions: [] });
    return { profile, totals };
  }));

  const configuredIds = new Set(profiles.map((profile) => profile.userId));
  const activeRows = rows.filter((row) => row.profile.enabled);
  const totalMonthlyDue = activeRows.reduce((sum, row) => sum + row.totals.salaryDue + row.totals.liability, 0);
  const totalOutstanding = activeRows.reduce((sum, row) => sum + row.totals.totalOutstanding, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Salary Management</h1>
            <p className="mt-1 text-sm text-slate-500">Set agent salary, permanent increment, monthly bonus, advance, partial/full salary, liabilities and fines.</p>
          </div>
          <Link href={`/api/finance/salary-sheet/pdf?month=${encodeURIComponent(month)}`} target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Download className="h-4 w-4" /> Download Salary Day PDF
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Salary Agents</p><p className="mt-2 text-xl font-bold">{activeRows.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Month</p><p className="mt-2 text-xl font-bold">{month}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Gross + Liability</p><p className="mt-2 text-xl font-bold text-emerald-700">{taka(totalMonthlyDue)}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Outstanding</p><p className="mt-2 text-xl font-bold text-amber-700">{taka(totalOutstanding)}</p></div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2"><UserRoundCog className="h-5 w-5 text-slate-600" /><div><h2 className="font-bold">Set / Update Agent Salary</h2><p className="text-sm text-slate-500">Changes apply to new salary months. Existing month snapshots keep their original base and increment.</p></div></div>
        <form action={saveSalaryProfileAction} className="grid gap-4 lg:grid-cols-12">
          <label className="lg:col-span-3"><span className="mb-1 block text-sm font-medium">Agent</span><select name="userId" required className="min-h-11 w-full rounded-xl border px-3 text-sm"><option value="">Select agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} (@{agent.username}) - {agent.role}</option>)}</select></label>
          <label className="lg:col-span-2"><span className="mb-1 block text-sm font-medium">Base Salary</span><input name="baseSalary" type="number" min="0.01" step="0.01" required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="lg:col-span-2"><span className="mb-1 block text-sm font-medium">Increment</span><input name="incrementAmount" type="number" min="0" step="0.01" defaultValue="0" required className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="lg:col-span-4"><span className="mb-1 block text-sm font-medium">Note</span><input name="note" placeholder="Optional salary note" className="min-h-11 w-full rounded-xl border px-3 text-sm" /></label>
          <div className="flex items-end lg:col-span-1"><button className="min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">Save</button></div>
        </form>
        {agents.some((agent) => !configuredIds.has(agent.id)) ? <p className="mt-4 text-xs text-slate-500">Only agents with a saved salary profile appear in the Salary Day PDF.</p> : null}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-slate-600" /><div><h2 className="font-bold">Monthly Salary Overview</h2><p className="text-sm text-slate-500">Click Details to add bonus, advance, liability, fine or salary payments.</p></div></div>
          <form method="get" className="flex items-end gap-2"><label><span className="mb-1 block text-xs font-medium text-slate-500">Month</span><input type="month" name="month" defaultValue={month} className="min-h-10 rounded-xl border px-3 text-sm" /></label><button className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Filter</button></form>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3">Agent</th><th className="px-4 py-3">Base</th><th className="px-4 py-3">Increment</th><th className="px-4 py-3">Bonus</th><th className="px-4 py-3">Advance</th><th className="px-4 py-3">Liability</th><th className="px-4 py-3">Fine</th><th className="px-4 py-3">Salary Paid</th><th className="px-4 py-3">Liability Paid</th><th className="px-4 py-3">Outstanding</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
            </tr></thead>
            <tbody>
              {rows.map(({ profile, totals }) => <tr key={profile.id} className="border-t">
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{profile.user.name}</p><p className="text-xs text-slate-500">@{profile.user.username} · {profile.user.role}</p></td>
                <td className="px-4 py-3">{taka(totals.baseSalary)}</td><td className="px-4 py-3">{taka(totals.increment)}</td><td className="px-4 py-3 text-emerald-700">{taka(totals.bonus)}</td><td className="px-4 py-3">{taka(totals.advance)}</td><td className="px-4 py-3">{taka(totals.liability)}</td><td className="px-4 py-3 text-rose-600">{taka(totals.fine)}</td><td className="px-4 py-3">{taka(totals.salaryPaid)}</td><td className="px-4 py-3">{taka(totals.liabilityPaid)}</td><td className="px-4 py-3 font-bold text-amber-700">{taka(totals.totalOutstanding)}</td>
                <td className="px-4 py-3">{profile.enabled ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">ACTIVE</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">DISABLED</span>}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Link href={`/dashboard/finance/salary/${profile.userId}?month=${month}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /> Details</Link><form action={toggleSalaryProfileAction}><input type="hidden" name="userId" value={profile.userId} /><input type="hidden" name="enabled" value={profile.enabled ? "false" : "true"} /><button className="min-h-9 rounded-lg border px-3 text-xs font-semibold">{profile.enabled ? "Disable" : "Enable"}</button></form></div></td>
              </tr>)}
              {rows.length === 0 ? <tr><td colSpan={12} className="px-5 py-10 text-center text-slate-500">No salary profiles yet. Set a salary above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
