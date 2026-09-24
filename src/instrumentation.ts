const SCHEDULER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

declare global {
  var __omsInternalSchedulerStarted: boolean | undefined;
}

async function triggerInternalScheduler() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const secret =
    process.env.INTERNAL_SCHEDULER_SECRET?.trim() ||
    process.env.SHOP_SETTINGS_ENCRYPTION_KEY?.trim();

  if (!secret) {
    console.error(
      "[OMSScheduler] INTERNAL_SCHEDULER_SECRET or SHOP_SETTINGS_ENCRYPTION_KEY is required."
    );
    return;
  }

  const port = process.env.PORT || "3000";
  const endpoint = `http://127.0.0.1:${port}/api/internal/scheduler`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      console.error(
        "[OMSScheduler] Internal scheduler endpoint failed:",
        response.status,
        payload?.message || response.statusText
      );
    }
  } catch (error) {
    console.error("[OMSScheduler] Internal scheduler request failed:", error);
  }
}

export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production" ||
    globalThis.__omsInternalSchedulerStarted
  ) {
    return;
  }

  globalThis.__omsInternalSchedulerStarted = true;

  setTimeout(() => {
    void triggerInternalScheduler();
  }, 30_000);

  const timer = setInterval(() => {
    void triggerInternalScheduler();
  }, SCHEDULER_CHECK_INTERVAL_MS);

  timer.unref?.();

  console.info(
    "[OMSScheduler] Started. Ready Order Sheet: 10:30 PM; Meta Ads: after 2:00 AM Asia/Dhaka."
  );
}
