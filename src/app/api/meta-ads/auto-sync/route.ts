import { NextRequest, NextResponse } from "next/server";

import {
  getBangladeshDateInputValue,
  getBangladeshTodayRange,
} from "@/lib/bangladesh-time";
import { syncMetaAdsRange } from "@/lib/meta-ads/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function authorized(request: NextRequest) {
  const secret = process.env.META_ADS_APP_SECRET?.trim();

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { complete: false, message: "Unauthorized Meta Ads auto-sync request." },
      { status: 401 }
    );
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
    return NextResponse.json({
      complete: true,
      message: "No enabled Meta ad accounts are connected.",
      fromDate,
      toDate,
      successCount: 0,
      failureCount: 0,
    });
  }

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    accountId: string;
    accountName: string;
    status: "SKIPPED" | "SUCCESS" | "FAILED";
    message: string;
  }> = [];

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
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (successfulRun) {
      successCount += 1;
      results.push({
        accountId: account.id,
        accountName: account.name,
        status: "SKIPPED",
        message: "Already synced successfully today.",
      });
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
      orderBy: { startedAt: "desc" },
      select: {
        status: true,
        startedAt: true,
      },
    });

    if (recentAttempt && recentAttempt.status !== "SUCCESS") {
      failureCount += 1;
      results.push({
        accountId: account.id,
        accountName: account.name,
        status: "FAILED",
        message: "A failed/retrying attempt already ran within the last hour.",
      });
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
      results.push({
        accountId: account.id,
        accountName: account.name,
        status: "SUCCESS",
        message: result.message,
      });
    } else {
      failureCount += 1;
      results.push({
        accountId: account.id,
        accountName: account.name,
        status: "FAILED",
        message: result.message,
      });
    }
  }

  const complete = failureCount === 0 && successCount === accounts.length;

  return NextResponse.json(
    {
      complete,
      fromDate,
      toDate,
      successCount,
      failureCount,
      results,
      message: complete
        ? "Meta Ads automatic sync is complete for all enabled accounts."
        : "Meta Ads automatic sync is incomplete; failed accounts will retry later.",
    },
    { status: complete ? 200 : 207 }
  );
}
