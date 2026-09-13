import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, CircleCheckBig, CircleX, Download, Eye } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { formatBangladeshDate, getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { roleLabel } from "@/lib/recruitment";
import { AttachExistingStaffForm, CreateStaffForm, RecruitmentInfoBanner } from "./recruitment-forms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusBadge(status: string) {
  if (status === "PERMANENT") return "bg-emerald-100 text-emerald-700";
  if (status === "TERMINATED") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function daysRemaining(endDate: Date) {
  const today = new Date(`${getBangladeshDateInputValue()}T00:00:00Z`);
  const end = new Date(`${getBangladeshDateInputValue(endDate)}T00:00:00Z`);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}

export default async function RecruitmentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");
  const { prisma } = await import("@/lib/prisma");

  const today = getBangladeshDateInputValue();

  const [profiles, existingUsers] = await Promise.all([
    prisma.staffEmploymentProfile.findMany({
      include: { user: true },
      orderBy: [{ employmentStatus: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["AGENT", "NOTE_AGENT", "PACKAGING_AGENT"] },
        staffEmploymentProfile: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true, role: true },
    }),
  ]);

  const probation = profiles.filter((p) => p.employmentStatus === "PROBATION");
  const permanent = profiles.filter((p) => p.employmentStatus === "PERMANENT");
  const terminated = profiles.filter((p) => p.employmentStatus === "TERMINATED");

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-900 p-3 text-white"><BriefcaseBusiness className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Staff Recruitment</h1><p className="mt-1 text-sm text-slate-500">Create staff records, manage the 15-day evaluation, permanent recruitment, termination and Bangla office-pad documents.</p></div>
        </div>
      </section>

      <RecruitmentInfoBanner />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-amber-700"><CalendarDays className="h-4 w-4" /><p className="text-sm font-medium">15-day Evaluation</p></div><p className="mt-2 text-2xl font-bold text-slate-900">{probation.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-emerald-700"><CircleCheckBig className="h-4 w-4" /><p className="text-sm font-medium">Permanent Staff</p></div><p className="mt-2 text-2xl font-bold text-slate-900">{permanent.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-rose-700"><CircleX className="h-4 w-4" /><p className="text-sm font-medium">Terminated</p></div><p className="mt-2 text-2xl font-bold text-slate-900">{terminated.length}</p></div>
      </section>

      <CreateStaffForm today={today} />
      <AttachExistingStaffForm users={existingUsers} today={today} />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5"><h2 className="font-bold text-slate-900">Staff Recruitment Register</h2><p className="mt-1 text-sm text-slate-500">Open a staff record to update details, recruit permanently, terminate or download documents.</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Role / Designation</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Basic Salary</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Period / Contract</th><th className="px-4 py-3">OMS Login</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {profiles.map((profile) => {
                const period = profile.employmentStatus === "PROBATION"
                  ? `${formatBangladeshDate(profile.probationStartDate)} → ${formatBangladeshDate(profile.probationEndDate)} (${daysRemaining(profile.probationEndDate)} days left)`
                  : profile.employmentStatus === "PERMANENT"
                    ? `${formatBangladeshDate(profile.agreementStartDate)} → ${formatBangladeshDate(profile.agreementEndDate)}`
                    : `Ended ${formatBangladeshDate(profile.terminationDate)}`;
                return <tr key={profile.id} className="border-t align-top">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{profile.user.name}</p><p className="text-xs text-slate-500">@{profile.user.username} · NID ••••{profile.nidLast4}</p></td>
                  <td className="px-4 py-3"><p>{profile.designation}</p><p className="text-xs text-slate-500">{roleLabel(profile.user.role)}</p></td>
                  <td className="px-4 py-3">{profile.phone}</td>
                  <td className="px-4 py-3">Tk {Number(profile.baseSalary).toLocaleString("en-BD")}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(profile.employmentStatus)}`}>{profile.employmentStatus}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{period}</td>
                  <td className="px-4 py-3">{profile.user.status ? <span className="font-semibold text-emerald-700">ACTIVE</span> : <span className="font-semibold text-rose-700">INACTIVE</span>}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Link href={`/dashboard/recruitment/${profile.userId}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /> Details</Link>{profile.employmentStatus === "PROBATION" ? <Link href={`/api/recruitment/${profile.userId}/probation-packet`} target="_blank" className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> 15-day Docs</Link> : null}{profile.employmentStatus === "PERMANENT" ? <Link href={`/api/recruitment/${profile.userId}/permanent-packet`} target="_blank" className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Permanent Docs</Link> : null}</div></td>
                </tr>;
              })}
              {profiles.length === 0 ? <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">No recruitment records yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
