const META_ADS_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const META_ADS_FIXED_HOUR = 2;

declare global {
  var __omsMetaAdsHttpSchedulerStarted: boolean | undefined;
  var __omsMetaAdsLastTriggeredBusinessDate: string | undefined;
}

function bangladeshClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

async function triggerMetaAdsAutoSync() {
  if (
    process.env.NODE_ENV !== "production" ||
    !process.env.META_ADS_APP_ID?.trim() ||
    !process.env.META_ADS_APP_SECRET?.trim()
  ) {
    return;
  }

  const now = bangladeshClock();

  if (now.hour < META_ADS_FIXED_HOUR) {
    return;
  }

  if (globalThis.__omsMetaAdsLastTriggeredBusinessDate === now.date) {
    return;
  }

  const port = process.env.PORT || "3000";
  const endpoint = `http://127.0.0.1:${port}/api/meta-ads/auto-sync`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.META_ADS_APP_SECRET}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { complete?: boolean; message?: string }
      | null;

    if (response.ok && payload?.complete) {
      globalThis.__omsMetaAdsLastTriggeredBusinessDate = now.date;
    }

    if (!response.ok) {
      console.error(
        "[MetaAdsScheduler] Auto-sync endpoint failed:",
        response.status,
        payload?.message || response.statusText
      );
    }
  } catch (error) {
    console.error("[MetaAdsScheduler] Auto-sync request failed:", error);
  }
}

function startMetaAdsHttpScheduler() {
  if (
    process.env.NODE_ENV !== "production" ||
    globalThis.__omsMetaAdsHttpSchedulerStarted
  ) {
    return;
  }

  globalThis.__omsMetaAdsHttpSchedulerStarted = true;

  setTimeout(() => {
    void triggerMetaAdsAutoSync();
  }, 30_000);

  const timer = setInterval(() => {
    void triggerMetaAdsAutoSync();
  }, META_ADS_CHECK_INTERVAL_MS);

  timer.unref?.();

  console.info(
    "[MetaAdsScheduler] Started. Fixed schedule: after 2:00 AM Asia/Dhaka; syncs the last 3 completed days."
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startReadyOrderSheetScheduler } = await import(
    "@/lib/google-sheets/scheduler"
  );

  startReadyOrderSheetScheduler();
  startMetaAdsHttpScheduler();
}
