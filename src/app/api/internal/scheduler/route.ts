import { NextRequest, NextResponse } from "next/server";

import {
  getBangladeshDateInputValue,
  getBangladeshTodayRange,
} from "@/lib/bangladesh-time";
import { runReadyOrderSheetSync } from "@/lib/google-sheets/sync";
import { syncMetaAdsRange } from "@/lib/meta-ads/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret =
    process.env.INTERNAL_SCHEDULER_SECRET?.trim() ||
    process.env.SHOP_SETTINGS_ENCRYPTION_KEY?.trim();

  return Boolean(
    secret &&
      request.headers.get("authorization") === `Bearer ${secret}`
  );
}

function bangladeshClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
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

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function runReadyOrderSheetIfDue() {
  const clock = bangladeshClock();
  const currentMinutes = clock.hour * 60 + clock.minute;
  const fixedMinutes = 22 * 60 + 30;

  if (currentMinutes < fixedMinutes) {
    return { status: "NOT_DUE" as const, message: "Ready Order Sheet is not due yet." };
  }

  const { prisma } = await import("@/lib/prisma");
  const setting = await prisma.readyOrderSheetSetting.findUnique({
    where: { id: "default" },
  });

  if (
    !setting?.spreadsheetId ||
    !setting.serviceAccountEncrypted ||
    !setting.serviceAccountIv ||
    !setting.serviceAccountTag
  ) {
    return {
      status: "SKIPPED" as const,
      message: "Ready Order Sheet credentials are not configured.",
    };
  }

  const today = getBangladeshDateInputValue();

  if (setting.lastAutoSyncBusinessDate === today) {
    return {
      status: "ALREADY_DONE" as const,
      message: "Ready Order Sheet already synced today.",
    };
  }

  try {
    const result = await runReadyOrderSheetSync({
      businessDate: today,
      mode: "AUTO",
    });

    return {
      status: "SUCCESS" as const,
      message: result.message,
    };
  } catch (error) {
    return {
      status: "FAILED" as const,
      message:
        error instanceof Error
          ? error.message
          : "Ready Order Sheet automatic sync failed.",
    };
  }
}

async function runMetaAdsIfDue() {
  if (
    !process.env.META_ADS_APP_ID?.trim() ||
    !process.env.META_ADS_APP_SECRET?.trim()
  ) {
    return {
      status: "SKIPPED" as const,
      message: "Meta Ads app credentials are not configured.",
      successCount: 0,
      failureCount: 0,
    };
  }

  const clock = bangladeshClock();

  if (clock.hour < 2) {
    return {
      status: "NOT_DUE" as const,
      message: "Meta Ads automatic sync is not due yet.",
      successCount: 0,
      failureCount: 0,
    };
  }

  const today = getBangladeshDateInputValue();
  const toDate = shiftDate(today, -1);
  const fromDate = shiftDate(toDate, -2);
  const todayRange = getBangladeshTodayRange();

  const { prisma } = await import("@/lib/prisma");
  const accounts = await prisma.metaAdAccount.findMany({
    where: {
      enabled: true,
      connection: { status: true },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!accounts.length) {
    return {
      status: "SKIPPED" as const,
      message: "No enabled Meta ad accounts are connected.",
      successCount: 0,
      failureCount: 0,
    };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const account of accounts) {
    const successfulRun = await prisma.metaAdsSyncRun.findFirst({
      where: {
        adAccountId: account.id,
        mode: "AUTO",
        toDate,
        status: "SUCCESS",
        startedAt: {
          gte: todayRange.start,
          lte: todayRange.end,
        },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (successfulRun) {
      successCount += 1;
      continue;
    }

    const recentAttempt = await prisma.metaAdsSyncRun.findFirst({
      where: {
        adAccountId: account.id,
        mode: "AUTO",
        toDate,
        startedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
      select: { status: true },
      orderBy: { startedAt: "desc" },
    });

    if (recentAttempt && recentAttempt.status !== "SUCCESS") {
      failureCount += 1;
      continue;
    }

    const result = await syncMetaAdsRange({
      accountId: account.id,
      fromDate,
      toDate,
      mode: "AUTO",
    });

    if (result.failureCount === 0 && result.successCount > 0) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  return {
    status:
      failureCount === 0 ? ("SUCCESS" as const) : ("PARTIAL_OR_FAILED" as const),
    message:
      successCount +
      " Meta ad account(s) synced/already complete; " +
      failureCount +
      " failed or waiting for retry.",
    successCount,
    failureCount,
  };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { message: "Unauthorized internal scheduler request." },
      { status: 401 }
    );
  }

  const [readyOrderSheet, metaAds] = await Promise.all([
    runReadyOrderSheetIfDue(),
    runMetaAdsIfDue(),
  ]);

  return NextResponse.json({
    ok: true,
    businessDate: getBangladeshDateInputValue(),
    readyOrderSheet,
    metaAds,
  });
}
