import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue, getBangladeshDayRange, formatBangladeshDateTime } from "@/lib/bangladesh-time";
import { DEFAULT_READY_ORDER_SHEET_NAME, DEFAULT_READY_ORDER_SPREADSHEET_ID } from "@/lib/google-sheets/settings";
import { saveSheetSyncSettings, testSheetSyncConnection, runSheetSyncNow } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams?: Promise<{ success?: string; error?: string }> };

export default async function SheetSyncPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");
  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const setting = await prisma.readyOrderSheetSetting.findUnique({ where: { id: "default" } });
  const today = getBangladeshDateInputValue();
  const range = getBangladeshDayRange(today);
  const spreadsheetId = setting?.spreadsheetId || DEFAULT_READY_ORDER_SPREADSHEET_ID;
  const sheetName = setting?.sheetName || DEFAULT_READY_ORDER_SHEET_NAME;

  const [todayReady, todaySynced, runs] = await Promise.all([
    prisma.order.count({ where: { orderStatus: "READY_TO_SHIP", readyToShipAt: { gte: range.start, lte: range.end } } }),
    prisma.readyOrderSheetSyncItem.count({ where: { businessDate: today, spreadsheetId, sheetName } }),
    prisma.readyOrderSheetSyncRun.findMany({
      include: { triggeredByUser: { select: { name: true, username: true } } },
      orderBy: { startedAt: "desc" }, take: 20,
    }),
  ]);

  return <div className="space-y-5">
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Ready Order Sheet Sync</h1>
      <p className="mt-1 text-sm text-slate-500">Automatically store every READY_TO_SHIP order in your “Data Storage For OMS” Google Sheet for daily courier tracing.</p>
    </section>

    {params.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{params.success}</div> : null}
    {params.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{params.error}</div> : null}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Today Ready Orders</p><p className="mt-1 text-2xl font-bold">{todayReady}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Synced Today</p><p className="mt-1 text-2xl font-bold text-emerald-600">{todaySynced}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Pending Today</p><p className="mt-1 text-2xl font-bold text-amber-600">{Math.max(0, todayReady - todaySynced)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Automatic Sync</p><p className={`mt-1 text-lg font-bold ${setting?.serviceAccountEmail ? "text-emerald-600" : "text-amber-600"}`}>{setting?.serviceAccountEmail ? "ON · 10:30 PM" : "Waiting for Google Setup"}</p><p className="text-xs text-slate-500">Fixed Bangladesh time</p></div>
    </section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Google Sheet Configuration</h2>
      <p className="mt-1 text-sm text-slate-500">The sheet is fixed to your Data Storage For OMS spreadsheet by default. Add a Google Service Account JSON and share the Sheet with that service-account email as Editor.</p>
      <form action={saveSheetSyncSettings} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Spreadsheet ID</span><input name="spreadsheetId" defaultValue={spreadsheetId} className="w-full rounded-xl border px-3 py-2.5" required /></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Sheet Tab Name</span><input name="sheetName" defaultValue={sheetName} className="w-full rounded-xl border px-3 py-2.5" required /></label>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Automatic daily sync is fixed at 10:30 PM Bangladesh time.</strong>
          <p className="mt-1 text-emerald-800">There is no editable schedule and no Railway cron setup. Once Google credentials are saved, the OMS server checks the time internally and runs the daily Ready to Ship sync automatically.</p>
        </div>
        <label className="block space-y-1.5 text-sm"><span className="font-medium">Google Service Account JSON</span><textarea name="serviceAccountJson" rows={7} placeholder={setting?.serviceAccountEmail ? `Credentials already saved for ${setting.serviceAccountEmail}. Leave blank to keep them.` : "Paste the complete Google Service Account JSON here"} className="w-full rounded-xl border px-3 py-2.5 font-mono text-xs"/><span className="text-xs text-slate-500">Encrypted with your existing SHOP_SETTINGS_ENCRYPTION_KEY. The full credential is never returned to the browser.</span></label>
        {setting?.serviceAccountEmail ? <div className="rounded-xl bg-slate-50 p-3 text-sm">Saved Service Account: <strong>{setting.serviceAccountEmail}</strong> — this email must have Editor access to the Google Sheet.</div> : null}
        <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Save Settings</button></div>
      </form>
      <form action={testSheetSyncConnection} className="mt-3"><button className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Test Connection</button></form>
    </section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Manual Sync</h2>
      <p className="mt-1 text-sm text-slate-500">Run any Ready to Ship business date manually. Re-running the same date does not create duplicate rows.</p>
      <form action={runSheetSyncNow} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="space-y-1.5 text-sm"><span className="font-medium">Ready to Ship Date</span><input name="businessDate" type="date" defaultValue={today} className="rounded-xl border px-3 py-2.5" required /></label>
        <button className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white">Run Sync Now</button>
      </form>
    </section>

    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Sync History</h2><p className="text-sm text-slate-500">Last 20 manual/automatic sync runs.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ready</th><th className="px-4 py-3">Added</th><th className="px-4 py-3">Skipped</th><th className="px-4 py-3">By</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Message</th></tr></thead><tbody>
        {runs.map(run => <tr key={run.id} className="border-t"><td className="px-4 py-3 font-medium">{run.businessDate}</td><td className="px-4 py-3">{run.mode}</td><td className={`px-4 py-3 font-semibold ${run.status === "SUCCESS" ? "text-emerald-600" : run.status === "FAILED" ? "text-red-600" : "text-amber-600"}`}>{run.status}</td><td className="px-4 py-3">{run.totalReadyOrders}</td><td className="px-4 py-3 text-emerald-600">{run.appendedOrders}</td><td className="px-4 py-3">{run.skippedOrders}</td><td className="px-4 py-3">{run.triggeredByUser ? `${run.triggeredByUser.name} (@${run.triggeredByUser.username})` : run.mode === "AUTO" ? "Scheduler" : "—"}</td><td className="px-4 py-3 whitespace-nowrap">{formatBangladeshDateTime(run.startedAt)}</td><td className="px-4 py-3 max-w-md">{run.message || "—"}</td></tr>)}
        {!runs.length ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No sync has run yet.</td></tr> : null}
      </tbody></table></div>
    </section>
  </div>;
}
