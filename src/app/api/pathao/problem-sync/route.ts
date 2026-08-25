import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { getPathaoOrderInfo } from "@/lib/pathao/client";
import { extractPathaoAmountToCollect } from "@/lib/pathao/order-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH_SIZE = 20;
const CONCURRENCY = 4;
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

type SyncRequest = {
  date?: string;
  force?: boolean;
  limit?: number;
};

type SyncOrder = {
  id: string;
  pathaoCourierId: string | null;
  pathaoConsignmentId: string | null;
  pathaoMerchantOrderId: string | null;
  pathaoOrderStatus: string | null;
  pathaoOrderStatusSlug: string | null;
  pathaoAmountToCollect: unknown;
};

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>
) {
  const output: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= values.length) return;
      output[current] = await mapper(values[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  );

  return output;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "NOTE_AGENT"].includes(session.user.role)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as SyncRequest;
    const selectedDate =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getBangladeshDateInputValue();

    const force = body.force === true;
    const requestedLimit = Number(body.limit || MAX_BATCH_SIZE);
    const take = Math.max(
      1,
      Math.min(MAX_BATCH_SIZE, Number.isFinite(requestedLimit) ? requestedLimit : MAX_BATCH_SIZE)
    );

    const { prisma } = await import("@/lib/prisma");
    const retryBefore = new Date(Date.now() - RETRY_COOLDOWN_MS);

    const baseWhere = {
      pathaoConsignmentId: { not: null as null | string },
      pathaoCourierId: { not: null as null | string },
      readyToShipAt: {
        gte: bangladeshDateStartUtc(selectedDate),
        lte: bangladeshDateEndUtc(selectedDate),
      },
    };

    const orders = await prisma.order.findMany({
      where: {
        ...baseWhere,
        ...(force
          ? {}
          : {
              pathaoAmountToCollect: null,
              OR: [
                { pathaoLastSyncedAt: null },
                { pathaoLastSyncedAt: { lt: retryBefore } },
              ],
            }),
      },
      select: {
        id: true,
        pathaoCourierId: true,
        pathaoConsignmentId: true,
        pathaoMerchantOrderId: true,
        pathaoOrderStatus: true,
        pathaoOrderStatusSlug: true,
        pathaoAmountToCollect: true,
      },
      orderBy: [
        { pathaoLastSyncedAt: "asc" },
        { createdAt: "asc" },
      ],
      take,
    });

    const results = await mapWithConcurrency(
      orders as SyncOrder[],
      CONCURRENCY,
      async (order) => {
        if (!order.pathaoCourierId || !order.pathaoConsignmentId) {
          return {
            id: order.id,
            success: false,
            amountFound: false,
            message: "Pathao courier or consignment ID missing.",
          };
        }

        try {
          const info = await getPathaoOrderInfo(
            order.pathaoCourierId,
            order.pathaoConsignmentId
          );

          const amountToCollect = extractPathaoAmountToCollect(info);
          const now = new Date();

          await prisma.order.update({
            where: { id: order.id },
            data: {
              pathaoMerchantOrderId:
                info.merchant_order_id || order.pathaoMerchantOrderId,
              pathaoOrderStatus:
                info.order_status || order.pathaoOrderStatus,
              pathaoOrderStatusSlug:
                info.order_status_slug || order.pathaoOrderStatusSlug,
              ...(amountToCollect !== null
                ? { pathaoAmountToCollect: amountToCollect }
                : {}),
              pathaoSubmissionStatus: "CONSIGNMENT_CREATED",
              pathaoLastSyncedAt: now,
              pathaoLastError:
                amountToCollect === null
                  ? "Pathao order-info response did not include Amount to Collect."
                  : null,
              pathaoRawResponse: JSON.stringify(info),
            },
          });

          return {
            id: order.id,
            success: true,
            amountFound: amountToCollect !== null,
            amount: amountToCollect,
            message:
              amountToCollect === null
                ? "Pathao replied, but Amount to Collect was not present."
                : "Amount synced.",
          };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Pathao order sync failed.";

          await prisma.order.update({
            where: { id: order.id },
            data: {
              pathaoLastSyncedAt: new Date(),
              pathaoLastError: message,
            },
          });

          return {
            id: order.id,
            success: false,
            amountFound: false,
            message,
          };
        }
      }
    );

    const synced = results.filter(
      (result) => result.success && result.amountFound
    ).length;
    const noAmount = results.filter(
      (result) => result.success && !result.amountFound
    ).length;
    const failed = results.filter((result) => !result.success).length;

    // Remaining rows eligible for automatic retry now. Recently attempted
    // rows are intentionally excluded for 10 minutes to prevent an endless
    // loop if Pathao does not return amount_to_collect for a parcel.
    const remainingEligible = await prisma.order.count({
      where: {
        ...baseWhere,
        pathaoAmountToCollect: null,
        OR: [
          { pathaoLastSyncedAt: null },
          { pathaoLastSyncedAt: { lt: retryBefore } },
        ],
      },
    });

    const totalStillUnsynced = await prisma.order.count({
      where: {
        ...baseWhere,
        pathaoAmountToCollect: null,
      },
    });

    return NextResponse.json({
      success: true,
      selectedDate,
      attempted: orders.length,
      synced,
      noAmount,
      failed,
      remainingEligible,
      totalStillUnsynced,
      message:
        orders.length === 0
          ? "No Pathao parcels currently need an amount sync."
          : `Checked ${orders.length}: ${synced} amount(s) synced, ${noAmount} response(s) had no amount, ${failed} failed.`,
    });
  } catch (error) {
    console.error("Pathao Problem bulk sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync Pathao amounts.",
      },
      { status: 500 }
    );
  }
}
