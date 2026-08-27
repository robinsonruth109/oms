import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { runReadyOrderSheetSync } from "@/lib/google-sheets/sync";

const FIXED_SYNC_HOUR = 22;
const FIXED_SYNC_MINUTE = 30;
const CHECK_INTERVAL_MS = 60_000;

declare global {
  var __omsReadyOrderSheetSchedulerStarted: boolean | undefined;
}

function bangladeshClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
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
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

async function runIfDue() {
  const { prisma } = await import("@/lib/prisma");
  const setting = await prisma.readyOrderSheetSetting.findUnique({
    where: { id: "default" },
  });

  // Scheduler becomes active automatically after valid Sheet credentials
  // have been saved. There is no editable schedule and no Railway cron.
  if (
    !setting?.spreadsheetId ||
    !setting.serviceAccountEncrypted ||
    !setting.serviceAccountIv ||
    !setting.serviceAccountTag
  ) {
    return;
  }

  const today = getBangladeshDateInputValue();

  if (setting.lastAutoSyncBusinessDate === today) {
    return;
  }

  const now = bangladeshClock();
  const currentMinutes = now.hour * 60 + now.minute;
  const fixedMinutes = FIXED_SYNC_HOUR * 60 + FIXED_SYNC_MINUTE;

  // If the OMS process restarted after 10:30 PM, the next scheduler check
  // catches up automatically for today's Ready to Ship memo.
  if (currentMinutes < fixedMinutes) {
    return;
  }

  try {
    await runReadyOrderSheetSync({
      businessDate: today,
      mode: "AUTO",
    });
  } catch (error) {
    console.error(
      "[ReadyOrderSheetScheduler] Automatic 10:30 PM sync failed:",
      error
    );
  }
}

export function startReadyOrderSheetScheduler() {
  if (globalThis.__omsReadyOrderSheetSchedulerStarted) {
    return;
  }

  globalThis.__omsReadyOrderSheetSchedulerStarted = true;

  // Check shortly after server startup, then once per minute.
  setTimeout(() => {
    void runIfDue();
  }, 15_000);

  const timer = setInterval(() => {
    void runIfDue();
  }, CHECK_INTERVAL_MS);

  // Do not keep Node alive solely because of this interval during shutdown.
  timer.unref?.();

  console.info(
    "[ReadyOrderSheetScheduler] Started. Fixed schedule: 10:30 PM Asia/Dhaka."
  );
}
