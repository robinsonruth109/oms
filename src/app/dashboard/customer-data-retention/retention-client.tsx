"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RetentionClientProps = {
  eligibleCount: number;
  retentionDays: number;
  cutoffIso: string;
};

type ApiResult = {
  success?: boolean;
  message?: string;
  anonymizedCount?: number;
};

export default function RetentionClient({
  eligibleCount,
  retentionDays,
  cutoffIso,
}: RetentionClientProps) {
  const router = useRouter();

  const [backupStarted, setBackupStarted] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canDelete =
    eligibleCount > 0 &&
    backupStarted &&
    backupConfirmed &&
    confirmation === "DELETE" &&
    !isDeleting;

  async function anonymizeEligibleCustomerData() {
    if (!canDelete) {
      return;
    }

    setIsDeleting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/admin/customer-data-retention/anonymize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            confirmation,
            backupConfirmed,
          }),
        }
      );

      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Customer data could not be anonymized."
        );
      }

      setSuccessMessage(
        result.message ||
          `${result.anonymizedCount ?? 0} order(s) anonymized.`
      );
      setConfirmation("");
      setBackupConfirmed(false);
      setBackupStarted(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Customer data could not be anonymized."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Step 1 — Backup first
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Download customer/order data in CSV
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Download the complete CSV before deleting any customer
            information. The full backup contains every OMS order,
            including customer details, amounts, statuses, source/page,
            Meta audit fields and line items.
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <a
            href="/api/admin/customer-data-retention/export?scope=all"
            onClick={() => setBackupStarted(true)}
            className="flex min-h-28 flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-5 transition hover:border-blue-400 hover:bg-blue-100"
          >
            <div>
              <p className="font-bold text-blue-950">
                Download COMPLETE CSV Backup
              </p>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                Includes all current OMS orders, not only records older
                than {retentionDays} days.
              </p>
            </div>
            <span className="mt-4 text-sm font-bold text-blue-700">
              Download CSV ↓
            </span>
          </a>

          <a
            href="/api/admin/customer-data-retention/export?scope=eligible"
            className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-400 hover:bg-slate-100"
          >
            <div>
              <p className="font-bold text-slate-950">
                Download 90+ Day Records Only
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Exports the exact set currently eligible for
                anonymization.
              </p>
            </div>
            <span className="mt-4 text-sm font-bold text-slate-700">
              Download CSV ↓
            </span>
          </a>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6">
          CSV exports are available only to an authenticated ADMIN.
          Customer-entered cells are escaped to reduce spreadsheet
          formula-injection risk.
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-200 bg-red-50 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
            Step 2 — Manual cleanup
          </p>
          <h2 className="mt-2 text-xl font-bold text-red-950">
            Anonymize customer personal data
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-red-800">
            This is irreversible inside the OMS. It affects only
            customer-identifying fields on orders older than{" "}
            {retentionDays} days. It does not delete the order,
            invoice, product lines, quantities, amounts or order status.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-bold text-amber-950">
              {eligibleCount.toLocaleString("en-US")} order(s) currently
              eligible
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Cutoff: {new Date(cutoffIso).toLocaleString("en-GB")}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(event) =>
                setBackupConfirmed(event.target.checked)
              }
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-semibold text-slate-950">
                I downloaded and checked my CSV backup.
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                Keep the CSV in a secure location because it contains
                customer personal data.
              </span>
            </span>
          </label>

          {!backupStarted && (
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              Click “Download COMPLETE CSV Backup” above before the
              delete button can be enabled.
            </p>
          )}

          <div>
            <label
              htmlFor="retention-confirmation"
              className="text-sm font-bold text-slate-900"
            >
              Type DELETE to confirm
            </label>

            <input
              id="retention-confirmation"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value.toUpperCase())
              }
              autoComplete="off"
              placeholder="DELETE"
              className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm font-bold uppercase outline-none focus:border-red-500"
            />
          </div>

          <button
            type="button"
            onClick={anonymizeEligibleCustomerData}
            disabled={!canDelete}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isDeleting
              ? "Anonymizing..."
              : `Anonymize ${eligibleCount.toLocaleString(
                  "en-US"
                )} Eligible Order(s)`}
          </button>

          <p className="text-xs leading-5 text-slate-500">
            Removed/anonymized fields: customer name, phone, delivery
            address, customer/free-text note, old checkout idempotency
            token, and stored Meta provider response/error bodies.
          </p>
        </div>
      </section>
    </div>
  );
}
