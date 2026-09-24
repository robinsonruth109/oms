import {
  getBangladeshDateInputValue,
  getBangladeshTodayRange,
} from "@/lib/bangladesh-time";
import { syncMetaAdsRange } from "./sync";

const FIXED_SYNC_HOUR = 2;
const FIXED_SYNC_MINUTE = 0;
const CHECK_INTERVAL_MS = 60000;

declare global {
  var __omsMetaAdsSchedulerStarted: boolean | undefined;
}

function bangladeshClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return { hour: Number(values.hour), minute: Number(values.minute) };
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function runIfDue() {
  if (!process.env.META_ADS_APP_ID || !process.env.META_ADS_APP_SECRET) return;

  const clock = bangladeshClock();
  if (clock.hour * 60 + clock.minute < FIXED_SYNC_HOUR * 60 + FIXED_SYNC_MINUTE) return;

  const today = getBangladeshDateInputValue();
  const toDate = shiftDate(today, -1);
  const fromDate = shiftDate(toDate, -2);
  const todayRange = getBangladeshTodayRange();
  const { prisma } = await import("@/lib/prisma");
  const accounts = await prisma.metaAdAccount.findMany({
    where: { enabled: true, connection: { status: true } },
    select: { id: true },
  });

  for (const account of accounts) {
    const recentRun = await prisma.metaAdsSyncRun.findFirst({
      where: {
        adAccountId: account.id,
        mode: "AUTO",
        toDate,
        startedAt: { gte: todayRange.start, lte: todayRange.end },
      },
      orderBy: { startedAt: "desc" },
    });

    if (recentRun?.status === "SUCCESS") continue;
    if (recentRun && recentRun.startedAt.getTime() > Date.now() - 60 * 60 * 1000) continue;

    await syncMetaAdsRange({
      accountId: account.id,
      fromDate,
      toDate,
      mode: "AUTO",
    }).catch((error) => console.error("[MetaAdsScheduler] Automatic sync failed:", error));
  }
}

export function startMetaAdsScheduler() {
  if (globalThis.__omsMetaAdsSchedulerStarted) return;
  globalThis.__omsMetaAdsSchedulerStarted = true;

  setTimeout(() => void runIfDue(), 20000);
  const timer = setInterval(() => void runIfDue(), CHECK_INTERVAL_MS);
  timer.unref?.();

  console.info(
    "[MetaAdsScheduler] Started. Fixed schedule: 2:00 AM Asia/Dhaka; syncs the last 3 completed days."
  );
}
