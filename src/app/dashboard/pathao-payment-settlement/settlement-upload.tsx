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
            {busy ? "Verifying Payment File..." : "Upload & Verify Payment CSV"}
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
