"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

type SyncResponse = {
  success: boolean;
  message: string;
  attempted?: number;
  synced?: number;
  noAmount?: number;
  failed?: number;
  remainingEligible?: number;
  totalStillUnsynced?: number;
};

export default function PathaoProblemBulkSync({
  selectedDate,
  initialUnsynced,
}: {
  selectedDate: string;
  initialUnsynced: number;
}) {
  const router = useRouter();
  const autoStarted = useRef(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(
    initialUnsynced > 0
      ? `${initialUnsynced} parcel(s) need Pathao amount verification.`
      : "All parcels with a stored Pathao amount are already classified."
  );
  const [progress, setProgress] = useState({
    checked: 0,
    synced: 0,
    noAmount: 0,
    failed: 0,
  });

  async function runSync(force: boolean) {
    if (running) return;

    setRunning(true);
    setProgress({ checked: 0, synced: 0, noAmount: 0, failed: 0 });

    let totalChecked = 0;
    let totalSynced = 0;
    let totalNoAmount = 0;
    let totalFailed = 0;
    let remaining = 1;
    let rounds = 0;

    try {
      // 20 requests per server batch, max 20 rounds = up to 400 parcels.
      // This avoids one long Railway request while still clearing a normal
      // day's queue automatically.
      while (remaining > 0 && rounds < 20) {
        rounds += 1;

        const response = await fetch("/api/pathao/problem-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            force: force && rounds === 1,
            limit: 20,
          }),
        });

        const body = (await response.json()) as SyncResponse;

        if (!response.ok || !body.success) {
          throw new Error(body.message || "Pathao amount sync failed.");
        }

        const attempted = Number(body.attempted || 0);
        totalChecked += attempted;
        totalSynced += Number(body.synced || 0);
        totalNoAmount += Number(body.noAmount || 0);
        totalFailed += Number(body.failed || 0);
        remaining = Number(body.remainingEligible || 0);

        setProgress({
          checked: totalChecked,
          synced: totalSynced,
          noAmount: totalNoAmount,
          failed: totalFailed,
        });

        setStatus(
          `Checking Pathao… ${totalChecked} checked · ${totalSynced} amount(s) synced · ${remaining} waiting`
        );

        if (attempted === 0) break;
      }

      setStatus(
        totalChecked === 0
          ? "No parcels currently require an automatic Pathao amount sync."
          : `Sync finished: ${totalChecked} checked, ${totalSynced} amount(s) synced, ${totalNoAmount} had no amount in Pathao response, ${totalFailed} failed.`
      );

      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Pathao amount sync failed."
      );
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStarted.current || initialUnsynced <= 0) return;
    autoStarted.current = true;
    void runSync(false);
    // Intentionally run once for this page/date load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUnsynced, selectedDate]);

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold text-blue-950">Pathao Amount Sync</p>
          <p className="mt-1 text-sm text-blue-800">{status}</p>

          {running ? (
            <p className="mt-2 text-xs text-blue-700">
              Checked {progress.checked} · Synced {progress.synced} · No amount{" "}
              {progress.noAmount} · Failed {progress.failed}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={running}
          onClick={() => void runSync(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Syncing..." : "Sync Pathao Amounts"}
        </button>
      </div>

      <p className="mt-3 text-xs text-blue-700">
        The page automatically checks unsynced consignments in small batches.
        Manual Sync forces a fresh check. If Pathao replies without an Amount to
        Collect field, OMS records the attempt and waits before retrying so it
        does not loop endlessly.
      </p>
    </div>
  );
}
