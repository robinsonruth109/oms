import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, FileText, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { formatBangladeshDate, formatBangladeshDateTime, getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { addDaysToBusinessDate, decryptNid } from "@/lib/recruitment";
import { recruitPermanentAction, terminateStaffAction, updateStaffProfileAction } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ userId: string }> };
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

function statusClass(status: string) {
  if (status === "PERMANENT") return "bg-emerald-100 text-emerald-700";
  if (status === "TERMINATED") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default async function RecruitmentDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");
  const { userId } = await params;
  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.staffEmploymentProfile.findUnique({
    where: { userId },
    include: { user: true, createdByUser: { select: { name: true, username: true } }, events: { include: { createdByUser: { select: { name: true, username: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!profile) notFound();

  let nid = "Unavailable";
  try { nid = decryptNid(profile); } catch { nid = `••••${profile.nidLast4}`; }
  const today = getBangladeshDateInputValue();
  const probationEnd = getBangladeshDateInputValue(profile.probationEndDate);
  const permanentAvailableDate = addDaysToBusinessDate(probationEnd, 1);
  const canRecruit = profile.employmentStatus === "PROBATION" && today >= permanentAvailableDate;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <Link href="/dashboard/recruitment" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Staff Recruitment</Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{profile.user.name}</h1><p className="mt-1 text-sm text-slate-500">@{profile.user.username} · {profile.designation}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(profile.employmentStatus)}`}>{profile.employmentStatus}</span></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Phone</p><p className="mt-2 font-semibold">{profile.phone}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">NID</p><p className="mt-2 font-semibold">{nid}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Basic Salary</p><p className="mt-2 font-semibold">Tk {Number(profile.baseSalary).toLocaleString("en-BD")}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">OMS Account</p><p className={`mt-2 font-semibold ${profile.user.status ? "text-emerald-700" : "text-rose-700"}`}>{profile.user.status ? "ACTIVE" : "INACTIVE"}</p></div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-bold text-slate-900">Employment Details</h2>
        <form action={updateStaffProfileAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="userId" value={profile.userId} />
          <label><span className={labelClass}>Father&apos;s Name</span><input name="fatherName" required defaultValue={profile.fatherName} className={inputClass} /></label>
          <label><span className={labelClass}>Phone</span><input name="phone" required defaultValue={profile.phone} className={inputClass} /></label>
          <label><span className={labelClass}>Designation</span><input name="designation" required defaultValue={profile.designation} className={inputClass} /></label>
          <label><span className={labelClass}>Basic Salary</span><input name="baseSalary" type="number" min="1" step="0.01" required defaultValue={Number(profile.baseSalary)} className={inputClass} /></label>
          <label><span className={labelClass}>15-day Compensation</span><input name="probationCompensation" type="number" min="0" step="0.01" defaultValue={Number(profile.probationCompensation)} className={inputClass} /></label>
          <label><span className={labelClass}>Early Exit Settlement Limit</span><input name="earlyExitSettlementLimit" type="number" min="0" step="0.01" defaultValue={Number(profile.earlyExitSettlementLimit)} className={inputClass} /></label>
          <label><span className={labelClass}>Duty Start</span><input name="dutyStartTime" type="time" required defaultValue={profile.dutyStartTime} className={inputClass} /></label>
          <label><span className={labelClass}>Work Off Deadline</span><input name="workOffDeadline" type="time" required defaultValue={profile.workOffDeadline} className={inputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><span className={labelClass}>Address</span><textarea name="address" required rows={3} defaultValue={profile.address} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <div className="md:col-span-2 xl:col-span-3 flex justify-end"><button disabled={profile.employmentStatus === "TERMINATED"} className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-40">Save Details</button></div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-slate-600" /><h2 className="font-bold">Documents</h2></div>
          <div className="space-y-3">
            <Link href={`/api/recruitment/${profile.userId}/probation-packet`} target="_blank" className="flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold hover:bg-slate-50"><span>15-day Appointment + Agreement</span><Download className="h-4 w-4" /></Link>
            {profile.employmentStatus === "PERMANENT" ? <Link href={`/api/recruitment/${profile.userId}/permanent-packet`} target="_blank" className="flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold hover:bg-slate-50"><span>Joining + Appointment + 6-month Agreement</span><Download className="h-4 w-4" /></Link> : null}
            {profile.employmentStatus === "TERMINATED" ? <Link href={`/api/recruitment/${profile.userId}/termination-letter`} target="_blank" className="flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold hover:bg-slate-50"><span>Termination Letter</span><Download className="h-4 w-4" /></Link> : null}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-600" /><h2 className="font-bold">Recruitment Status</h2></div>
          <div className="space-y-2 text-sm text-slate-600"><p>15-day period: <b>{formatBangladeshDate(profile.probationStartDate)} → {formatBangladeshDate(profile.probationEndDate)}</b></p>{profile.permanentJoinDate ? <p>Permanent joining: <b>{formatBangladeshDate(profile.permanentJoinDate)}</b></p> : null}{profile.agreementEndDate ? <p>6-month agreement end: <b>{formatBangladeshDate(profile.agreementEndDate)}</b></p> : null}{profile.terminationReason ? <p className="text-rose-700">Termination reason: <b>{profile.terminationReason}</b></p> : null}</div>

          {profile.employmentStatus === "PROBATION" ? <div className="mt-5 space-y-4">
            {!canRecruit ? <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Permanent recruitment unlocks after the 15-day period ends on {probationEnd}. Earliest permanent date: {permanentAvailableDate}.</div> : null}
            <form action={recruitPermanentAction} className="space-y-2"><input type="hidden" name="userId" value={profile.userId} /><label><span className={labelClass}>Permanent Joining Date</span><input type="date" name="joinDate" defaultValue={today < permanentAvailableDate ? permanentAvailableDate : today} min={permanentAvailableDate} required className={inputClass} /></label><button disabled={!canRecruit} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40"><UserRoundCheck className="h-4 w-4" /> Recruit Permanently</button></form>
            <form action={terminateStaffAction} className="space-y-2"><input type="hidden" name="userId" value={profile.userId} /><input type="date" name="terminationDate" defaultValue={today} className={inputClass} required /><textarea name="reason" required rows={2} placeholder="Termination reason" className="w-full rounded-xl border px-3 py-2.5 text-sm" /><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white"><UserRoundX className="h-4 w-4" /> Terminate & Deactivate OMS ID</button></form>
          </div> : null}

          {profile.employmentStatus === "PERMANENT" ? <form action={terminateStaffAction} className="mt-5 space-y-2"><input type="hidden" name="userId" value={profile.userId} /><input type="date" name="terminationDate" defaultValue={today} className={inputClass} required /><textarea name="reason" required rows={2} placeholder="Termination reason" className="w-full rounded-xl border px-3 py-2.5 text-sm" /><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white"><UserRoundX className="h-4 w-4" /> Terminate & Deactivate OMS ID</button></form> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5"><h2 className="font-bold">HR Audit Timeline</h2><p className="mt-1 text-sm text-slate-500">Every recruitment-stage change is recorded.</p></div>
        <div className="divide-y">{profile.events.map((event) => <div key={event.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[180px_180px_1fr]"><div className="font-semibold text-slate-900">{event.type.replaceAll("_", " ")}</div><div className="text-slate-500">{formatBangladeshDateTime(event.createdAt)}</div><div><p className="text-slate-700">{event.note || "-"}</p><p className="mt-1 text-xs text-slate-500">By {event.createdByUser.name} (@{event.createdByUser.username})</p></div></div>)}{profile.events.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">No events.</div> : null}</div>
      </section>
    </div>
  );
}
