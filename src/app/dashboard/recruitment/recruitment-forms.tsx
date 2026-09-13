"use client";

import { useActionState, useEffect, useState } from "react";
import { BriefcaseBusiness, UserPlus, UsersRound } from "lucide-react";
import {
  attachExistingStaffAction,
  createStaffAction,
  type RecruitmentActionState,
} from "./actions";

const initialState: RecruitmentActionState = { success: false, message: "" };

type ExistingUser = { id: string; name: string; username: string; role: string };

function Feedback({ state }: { state: RecruitmentActionState }) {
  if (!state.message) return null;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {state.message}
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

function CommonEmploymentFields({ today }: { today: string }) {
  return (
    <>
      <label><span className={labelClass}>Father&apos;s Name</span><input name="fatherName" required className={inputClass} placeholder="Father's full name" /></label>
      <label><span className={labelClass}>Phone Number</span><input name="phone" required inputMode="numeric" className={inputClass} placeholder="01XXXXXXXXX" /></label>
      <label><span className={labelClass}>NID Number</span><input name="nidNumber" required inputMode="numeric" className={inputClass} placeholder="10 / 13 / 17 digits" /></label>
      <label><span className={labelClass}>Designation</span><input name="designation" required className={inputClass} placeholder="Calling Agent / Packaging Agent" /></label>
      <label><span className={labelClass}>Basic Salary (Tk)</span><input name="baseSalary" required type="number" min="1" step="0.01" className={inputClass} /></label>
      <label><span className={labelClass}>15-day Period Compensation / Allowance (Tk)</span><input name="probationCompensation" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></label>
      <label><span className={labelClass}>Start Date</span><input name="startDate" required type="date" defaultValue={today} className={inputClass} /></label>
      <label><span className={labelClass}>Duty Start</span><input name="dutyStartTime" required type="time" defaultValue="09:00" className={inputClass} /></label>
      <label><span className={labelClass}>OMS Work Off Deadline</span><input name="workOffDeadline" required type="time" defaultValue="22:00" className={inputClass} /></label>
      <label><span className={labelClass}>Early Exit Settlement Limit (Tk)</span><input name="earlyExitSettlementLimit" type="number" min="0" step="0.01" defaultValue="10000" className={inputClass} /></label>
      <label className="md:col-span-2"><span className={labelClass}>Address</span><textarea name="address" required rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" placeholder="Full present/permanent address" /></label>
    </>
  );
}

export function CreateStaffForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createStaffAction, initialState);
  const [key, setKey] = useState(0);
  useEffect(() => { if (state.success) setKey((v) => v + 1); }, [state.success]);

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5"><UserPlus className="h-5 w-5 text-slate-700" /></div>
        <div><h2 className="text-lg font-bold text-slate-900">Appoint New Staff</h2><p className="text-sm text-slate-500">Creates the OMS login, employment profile, 15-day preliminary record and salary profile together.</p></div>
      </div>
      <form key={key} action={action} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label><span className={labelClass}>Full Name</span><input name="name" required className={inputClass} /></label>
          <label><span className={labelClass}>OMS Role</span><select name="role" defaultValue="AGENT" required className={inputClass}><option value="AGENT">AGENT</option><option value="NOTE_AGENT">NOTE AGENT</option><option value="PACKAGING_AGENT">PACKAGING AGENT</option></select></label>
          <label><span className={labelClass}>Username</span><input name="username" required autoComplete="off" className={inputClass} /></label>
          <label><span className={labelClass}>Password</span><input name="password" required type="password" minLength={6} autoComplete="new-password" className={inputClass} /></label>
          <CommonEmploymentFields today={today} />
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          If the 15-day compensation is set to Tk 0, have the arrangement reviewed for compliance before issuing the documents. The generated Bangla documents expressly preserve any wage/allowance required by applicable law.
        </div>
        <Feedback state={state} />
        <div className="flex justify-end"><button disabled={pending} className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Creating..." : "Create Staff & Start 15 Days"}</button></div>
      </form>
    </section>
  );
}

export function AttachExistingStaffForm({ users, today }: { users: ExistingUser[]; today: string }) {
  const [state, action, pending] = useActionState(attachExistingStaffAction, initialState);
  const [key, setKey] = useState(0);
  useEffect(() => { if (state.success) setKey((v) => v + 1); }, [state.success]);

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5"><UsersRound className="h-5 w-5 text-slate-700" /></div>
        <div><h2 className="text-lg font-bold text-slate-900">Add Existing Agent to HR Record</h2><p className="text-sm text-slate-500">Use this for agents who already have an OMS login. Their password is not changed.</p></div>
      </div>
      {users.length === 0 ? <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Every active agent already has a staff recruitment record.</div> : (
        <form key={key} action={action} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="xl:col-span-2"><span className={labelClass}>Existing Agent</span><select name="userId" required defaultValue="" className={inputClass}><option value="" disabled>Select agent</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} (@{u.username}) - {u.role}</option>)}</select></label>
            <label><span className={labelClass}>Current Stage</span><select name="stage" defaultValue="PERMANENT" className={inputClass}><option value="PERMANENT">Permanent / Existing Staff</option><option value="PROBATION">Start 15-day Period</option></select></label>
            <CommonEmploymentFields today={today} />
          </div>
          <Feedback state={state} />
          <div className="flex justify-end"><button disabled={pending} className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving..." : "Create HR Record"}</button></div>
        </form>
      )}
    </section>
  );
}

export function RecruitmentInfoBanner() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
      <div className="flex items-center gap-2 font-semibold"><BriefcaseBusiness className="h-4 w-4" /> Recruitment workflow</div>
      <p className="mt-1">Phase 1: create staff → 15-day preliminary evaluation → download appointment/agreement packet. Phase 2: after the period, permanently recruit for a 6-month agreement or terminate and immediately deactivate the OMS login.</p>
    </div>
  );
}
