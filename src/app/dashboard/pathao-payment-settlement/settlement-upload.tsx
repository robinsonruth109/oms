"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";

type UploadResult = {
  ok: true;
  fileName: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  apiErrorCount: number;
  courier: { id: string; name: string };
  totals: {
    collectedAmount: number;
    deliveryFee: number;
    codFee: number;
    totalFee: number;
  };
};

function money(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function SettlementUpload({
  couriers,
}: {
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{
    fileName: string;
    ok: boolean;
    result?: UploadResult;
    error?: string;
  }>>([]);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");

  async function sendFile(file: File): Promise<UploadResult> {
    const body = new FormData();
    body.set("file", file);
    body.set("courierId", courierId);

    const response = await fetch("/api/pathao/settlements/upload", {
      method: "POST",
      body,
    });
    const raw = await response.text();
    let data: any = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          raw ||
          `Payment sheet upload failed (HTTP ${response.status}).`
      );
    }

    if (!data?.ok) {
      throw new Error("Payment sheet upload returned an invalid response.");
    }

    return data as UploadResult;
  }

  async function uploadBulk(files: File[]) {
    if (!courierId) {
      setError("Select the Pathao courier/account for these payment sheets first.");
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    if (!files.length) return;

    if (files.length > 30) {
      setError("Bulk upload supports a maximum of 30 CSV files at a time.");
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: files.length });

    const results: Array<{
      fileName: string;
      ok: boolean;
      result?: UploadResult;
      error?: string;
    }> = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setBulkProgress({ current: index + 1, total: files.length });

        try {
          const fileResult = await sendFile(file);
          results.push({
            fileName: file.name,
            ok: true,
            result: fileResult,
          });
        } catch (err) {
          results.push({
            fileName: file.name,
            ok: false,
            error: err instanceof Error ? err.message : "Payment sheet upload failed.",
          });
        }

        setBulkResults([...results]);
      }

      router.refresh();
    } finally {
      setBusy(false);
      setBulkProgress(null);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  }

  async function upload(file: File) {
    if (!courierId) {
      setError("Select the Pathao courier/account for this payment sheet first.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const data = await sendFile(file);
      setResult(data);
      setBulkResults([]);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment sheet upload failed."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              Upload Pathao Payment CSV
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Select the exact Pathao account and upload the daily payment CSV.
            OMS checks every sheet consignment ID through that Pathao API account,
            gets the merchant order ID, matches it to the OMS invoice and marks the
            matched order <strong>PAYMENT DONE</strong>.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The CSV becomes the only source for Collected Amount, Delivery Fee,
            COD Fee and Total Fee. Webhooks are used only for parcel status tracking.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 xl:w-[380px]">
          <select
            value={courierId}
            onChange={(event) => setCourierId(event.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="">Select Pathao courier/account</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </select>

          <label
            className={[
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white",
              busy
                ? "bg-slate-400"
                : "bg-emerald-600 hover:bg-emerald-700",
            ].join(" ")}
          >
            <Upload className="h-4 w-4" />
            {busy && !bulkProgress ? "Verifying Payment File..." : "Upload & Verify Single CSV"}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>

          <label
            className={[
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold",
              busy
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
            ].join(" ")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {bulkProgress
              ? `Processing ${bulkProgress.current}/${bulkProgress.total} CSV files...`
              : "Bulk Upload CSVs (up to 30)"}
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              accept=".csv,.txt,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length) void uploadBulk(files);
              }}
            />
          </label>
          <p className="text-xs leading-5 text-slate-500">
            Bulk mode uses the same selected Pathao account and verifies each file separately. Files are processed safely one by one.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        Required columns: <strong>Order consignment id</strong>,{" "}
        <strong>Collected amount</strong>, <strong>Delivery fee</strong>,{" "}
        <strong>Cod fee</strong> and <strong>Total fee</strong>. Return
        consignment IDs may differ from outbound IDs; OMS resolves the sheet CID
        through Pathao before matching the merchant order ID to OMS.
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {bulkResults.length ? (
        <div className="mt-4 space-y-3">
          {(() => {
            const successful = bulkResults.filter((item) => item.ok && item.result);
            const failed = bulkResults.filter((item) => !item.ok);
            const totals = successful.reduce(
              (sum, item) => {
                const current = item.result!;
                sum.rows += current.rowCount;
                sum.matched += current.matchedCount;
                sum.unmatched += current.unmatchedCount;
                sum.errors += current.apiErrorCount;
                sum.collected += current.totals.collectedAmount;
                sum.delivery += current.totals.deliveryFee;
                sum.cod += current.totals.codFee;
                sum.totalFee += current.totals.totalFee;
                return sum;
              },
              { rows: 0, matched: 0, unmatched: 0, errors: 0, collected: 0, delivery: 0, cod: 0, totalFee: 0 }
            );

            return (
              <>
                <div className={[
                  "flex items-start gap-2 rounded-2xl border p-4 text-sm font-semibold",
                  failed.length
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                ].join(" ")}>
                  {failed.length ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <span>
                    Bulk upload processed {bulkResults.length} file(s): {successful.length} successful, {failed.length} failed.
                    {successful.length ? ` ${totals.matched} OMS order(s) marked PAYMENT DONE.` : ""}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Files Successful" value={String(successful.length)} />
                  <Stat label="Files Failed" value={String(failed.length)} />
                  <Stat label="CSV Rows" value={String(totals.rows)} />
                  <Stat label="Payment Done" value={String(totals.matched)} />
                  <Stat label="Unmatched" value={String(totals.unmatched)} />
                  <Stat label="Resolve Errors" value={String(totals.errors)} />
                  <Stat label="Collected Amount" value={"Tk " + money(totals.collected)} />
                  <Stat label="Delivery Fee" value={"Tk " + money(totals.delivery)} />
                  <Stat label="COD Fee" value={"Tk " + money(totals.cod)} />
                  <Stat label="Total Fee" value={"Tk " + money(totals.totalFee)} />
                </div>

                <div className="overflow-hidden rounded-2xl border">
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">File</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Rows</th>
                          <th className="px-4 py-3 text-right">Payment Done</th>
                          <th className="px-4 py-3 text-right">Unmatched</th>
                          <th className="px-4 py-3">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {bulkResults.map((item, index) => (
                          <tr key={item.fileName + "-" + index}>
                            <td className="px-4 py-3 font-medium">{item.fileName}</td>
                            <td className="px-4 py-3">
                              <span className={[
                                "rounded-full px-2 py-1 text-xs font-semibold",
                                item.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                              ].join(" ")}>
                                {item.ok ? "Verified" : "Failed"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">{item.result?.rowCount ?? "-"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{item.result?.matchedCount ?? "-"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-700">{item.result?.unmatchedCount ?? "-"}</td>
                            <td className="max-w-md px-4 py-3 text-xs text-slate-600">
                              {item.ok
                                ? `Verified through ${item.result?.courier.name || "selected Pathao account"}.`
                                : item.error || "Upload failed."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              {result.matchedCount} OMS order(s) verified through{" "}
              {result.courier.name} and marked PAYMENT DONE.
              {result.unmatchedCount
                ? ` ${result.unmatchedCount} row(s) are still unmatched and were not marked paid.`
                : ""}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="CSV Rows" value={String(result.rowCount)} />
            <Stat label="Payment Done" value={String(result.matchedCount)} />
            <Stat label="Unmatched" value={String(result.unmatchedCount)} />
            <Stat label="Resolve Errors" value={String(result.apiErrorCount)} />
            <Stat
              label="Collected Amount"
              value={"Tk " + money(result.totals.collectedAmount)}
            />
            <Stat
              label="Delivery Fee"
              value={"Tk " + money(result.totals.deliveryFee)}
            />
            <Stat
              label="COD Fee"
              value={"Tk " + money(result.totals.codFee)}
            />
            <Stat
              label="Total Fee"
              value={"Tk " + money(result.totals.totalFee)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}
