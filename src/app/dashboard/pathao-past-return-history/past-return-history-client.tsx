"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, History, Loader2, Upload } from "lucide-react";
import {
  processPastReturnBatchAction,
  type PastReturnResult,
} from "./actions";

type PassedRow = {
  id: string;
  consignmentId: string;
  outboundConsignmentId: string | null;
  invoiceId: string;
  customerName: string;
  phone: string;
  courierName: string;
  processedBy: string;
  processedAt: string;
};

type FailedRow = {
  id: string;
  consignmentId: string;
  merchantOrderId: string | null;
  reason: string;
  lookupStatus: string;
  checkedCourierCount: number;
  failedCourierCount: number;
  scanCount: number;
  lastScannedAt: string;
};

function normalizeCell(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function parseFirstColumn(text: string) {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const ids: string[] = [];

  for (const line of rows) {
    const first = normalizeCell(line.split(/[,;\t]/, 1)[0] || "");
    if (!first) continue;
    if (/CONSIGNMENT|ORDERCONSIGNMENT|^CID$|^ID$/.test(first.replace(/[^A-Z]/g, ""))) continue;
    ids.push(first);
  }

  return [...new Set(ids)];
}

function badge(status: PastReturnResult["status"]) {
  if (status === "RETURN_RECEIVED") return "bg-emerald-100 text-emerald-800";
  if (status === "ALREADY_RECORDED") return "bg-blue-100 text-blue-800";
  return "bg-rose-100 text-rose-800";
}

export default function PastReturnHistoryClient({
  initialPassed,
  initialFailed,
}: {
  initialPassed: PassedRow[];
  initialFailed: FailedRow[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [liveResults, setLiveResults] = useState<PastReturnResult[]>([]);
  const [error, setError] = useState("");

  const livePassed = useMemo(() => liveResults.filter((row) => row.success), [liveResults]);
  const liveFailed = useMemo(() => liveResults.filter((row) => !row.success), [liveResults]);

  async function onFile(file: File | null) {
    setError("");
    setLiveResults([]);
    setProcessedCount(0);

    if (!file) {
      setFileName("");
      setIds([]);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseFirstColumn(text);

      if (!parsed.length) {
        setError("No consignment IDs were found in column A.");
        setFileName(file.name);
        setIds([]);
        return;
      }

      setFileName(file.name);
      setIds(parsed);
    } catch {
      setError("Could not read this CSV file.");
      setIds([]);
    }
  }

  async function processFile() {
    if (!ids.length || running) return;

    setRunning(true);
    setError("");
    setLiveResults([]);
    setProcessedCount(0);

    try {
      const all: PastReturnResult[] = [];
      const batchSize = 10;

      for (let index = 0; index < ids.length; index += batchSize) {
        const batch = ids.slice(index, index + batchSize);
        const response = await processPastReturnBatchAction(batch);
        all.push(...response.results);
        setLiveResults([...all]);
        setProcessedCount(Math.min(index + batch.length, ids.length));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Historical return import failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pathao Past Return History</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">
              Upload old Pathao return consignment IDs from CSV column A. OMS resolves the Pathao parcel to Merchant Order ID → OMS invoice and records Return Received.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>No stock restoration on this page.</strong> Historical imports update return history/status only. Product Master stock remains unchanged.
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label className="text-sm font-semibold text-slate-800">CSV File · Column A = Consignment ID</label>
            <div className="mt-2 flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4">
              <FileSpreadsheet className="h-5 w-5 text-slate-500" />
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt,text/plain"
                onChange={(event) => void onFile(event.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {fileName ? `${fileName} · ${ids.length} unique consignment ID(s) ready` : "Header is optional. Only the first column is read."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void processFile()}
            disabled={!ids.length || running}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            {running ? `Processing ${processedCount}/${ids.length}` : `Upload & Process ${ids.length || ""}`}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {liveResults.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Processed</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{liveResults.length}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Passed</div>
              <div className="mt-1 text-2xl font-bold text-emerald-800">{livePassed.length}</div>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-rose-700">Failed</div>
              <div className="mt-1 text-2xl font-bold text-rose-800">{liveFailed.length}</div>
            </div>
          </div>
        ) : null}
      </section>

      {liveResults.length ? (
        <section className="rounded-3xl bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-bold text-slate-900">Current Upload Result</h2>
            <p className="mt-1 text-sm text-slate-500">Every CSV row stays visible here as Passed / Already Recorded / Failed.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">CSV CID</th>
                  <th className="px-5 py-3">OMS Invoice</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Pathao Account</th>
                  <th className="px-5 py-3">Outbound CID</th>
                  <th className="px-5 py-3">Return CID</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {liveResults.map((row, index) => (
                  <tr key={`${row.consignmentId}-${index}`} className="border-t">
                    <td className="px-5 py-3 font-semibold">{row.consignmentId}</td>
                    <td className="px-5 py-3">{row.invoiceId || "—"}</td>
                    <td className="px-5 py-3">{row.customerName || "—"}</td>
                    <td className="px-5 py-3">{row.courierName || "—"}</td>
                    <td className="px-5 py-3">{row.outboundConsignmentId || "—"}</td>
                    <td className="px-5 py-3">{row.returnConsignmentId || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badge(row.status)}`}>
                        {row.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-slate-900">Passed History</h2>
              <p className="text-xs text-slate-500">Historical returns recorded without stock restoration.</p>
            </div>
          </div>
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Return CID</th>
                  <th className="px-4 py-3">OMS Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3">Processed</th>
                </tr>
              </thead>
              <tbody>
                {initialPassed.length ? initialPassed.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{row.consignmentId}</td>
                    <td className="px-4 py-3">{row.invoiceId}</td>
                    <td className="px-4 py-3">{row.customerName}<div className="text-xs text-slate-400">{row.phone}</div></td>
                    <td className="px-4 py-3">{row.courierName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.processedAt}<div>{row.processedBy}</div></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No historical returns processed yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b p-5">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-900">Failed / Unresolved</h2>
              <p className="text-xs text-slate-500">These remain visible until a later upload resolves them.</p>
            </div>
          </div>
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">CID</th>
                  <th className="px-4 py-3">Merchant Order ID</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Pathao Check</th>
                  <th className="px-4 py-3">Last Try</th>
                </tr>
              </thead>
              <tbody>
                {initialFailed.length ? initialFailed.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3 font-semibold">{row.consignmentId}</td>
                    <td className="px-4 py-3">{row.merchantOrderId || "—"}</td>
                    <td className="px-4 py-3 text-rose-700"><div className="font-semibold">{row.lookupStatus}</div><div className="mt-1 text-xs">{row.reason}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.checkedCourierCount} checked · {row.failedCourierCount} failed</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.lastScannedAt}<div>{row.scanCount} attempt(s)</div></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No unresolved historical return rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
