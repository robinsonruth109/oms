"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Upload, AlertTriangle } from "lucide-react";

type UploadResult = {
  ok: true;
  fileName: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
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

export default function PathaoSettlementUpload({
  latest,
  couriers,
}: {
  couriers: Array<{ id: string; name: string }>;
  latest?: {
    fileName: string;
    rowCount: number;
    matchedCount: number;
    unmatchedCount: number;
    duplicateCount: number;
    createdAt: string;
  } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

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
      const body = new FormData();
      body.set("file", file);
      body.set("courierId", courierId);

      const response = await fetch("/api/pathao/settlements/upload", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Payment sheet upload failed.");
      }

      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment sheet upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              Pathao Payment Settlement
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Select the Pathao courier/account, then upload its payment CSV. OMS will
            query Pathao using every sheet consignment ID, resolve the Pathao merchant
            order ID back to the OMS invoice, and save the exact Collected Amount,
            Delivery Fee, COD Fee and Total Fee against that OMS order.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px]">
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

        <label className={[
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white",
          busy ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700",
        ].join(" ")}>
          <Upload className="h-4 w-4" />
          {busy ? "Uploading..." : "Upload Payment CSV"}
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
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-xs text-slate-600">
        Required Pathao columns: <strong>Order consignment id</strong>, Collected amount,
        Delivery fee, Cod fee and Total fee. The sheet CID may be an outbound ID or a
        different return ID; OMS resolves both through the selected Pathao API account
        before linking the row to the OMS order. Re-uploading safely updates existing rows.
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            Settlement imported and Profit Margin can now verify matched consignments.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Rows" value={String(result.rowCount)} />
            <Stat label="Matched OMS" value={String(result.matchedCount)} />
            <Stat label="Unmatched" value={String(result.unmatchedCount)} />
            <Stat label="Updated Existing" value={String(result.duplicateCount)} />
            <Stat label="Collected" value={"Tk " + money(result.totals.collectedAmount)} />
            <Stat label="Delivery Fee" value={"Tk " + money(result.totals.deliveryFee)} />
            <Stat label="COD Fee" value={"Tk " + money(result.totals.codFee)} />
            <Stat label="Total Pathao Fee" value={"Tk " + money(result.totals.totalFee)} />
          </div>
        </div>
      ) : latest ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
          <span className="font-semibold text-emerald-800">Latest settlement:</span>
          <span>{latest.fileName}</span>
          <span>{latest.rowCount} rows</span>
          <span>{latest.matchedCount} matched</span>
          <span>{latest.unmatchedCount} unmatched</span>
          <span>{new Date(latest.createdAt).toLocaleString("en-BD")}</span>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No Pathao settlement sheet uploaded yet. Profit Margin will continue using
          webhook-based estimates and will show an ESTIMATED warning.
        </div>
      )}
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
