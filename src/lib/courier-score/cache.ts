import { withDatabaseRetry } from "@/lib/database-retry";

import { calculateRiskLevel, calculateSuccessRate } from "./risk";
import { assertBangladeshPhone } from "./phone";
import type { CourierStats } from "./types";

export const COURIER_SCORE_CACHE_HOURS = 24;

export function getCourierScoreExpiry(from = new Date()): Date {
  return new Date(from.getTime() + COURIER_SCORE_CACHE_HOURS * 60 * 60 * 1000);
}

export async function readFreshCourierScore(phoneInput: unknown) {
  const phone = assertBangladeshPhone(phoneInput);
  const { prisma } = await import("@/lib/prisma");

  return withDatabaseRetry(() =>
    prisma.customerCourierScore.findFirst({
      where: {
        phone,
        expiresAt: { gt: new Date() },
      },
    })
  );
}

export async function saveCourierScore(phoneInput: unknown, couriers: CourierStats[]) {
  const phone = assertBangladeshPhone(phoneInput);
  const totalOrders = couriers.reduce((sum, courier) => sum + Math.max(0, courier.total), 0);
  const delivered = couriers.reduce((sum, courier) => sum + Math.max(0, courier.delivered), 0);
  const returned = couriers.reduce((sum, courier) => sum + Math.max(0, courier.returned), 0);
  const successRate = calculateSuccessRate(delivered, totalOrders);
  const riskLevel = calculateRiskLevel(totalOrders, successRate);
  const checkedAt = new Date();
  const expiresAt = getCourierScoreExpiry(checkedAt);
  const errors = couriers
    .filter((courier) => courier.error)
    .map((courier) => ({ provider: courier.provider, message: courier.error }));

  const { prisma } = await import("@/lib/prisma");

  const errorData = errors.length > 0 ? { errors } : {};

  return withDatabaseRetry(() =>
    prisma.customerCourierScore.upsert({
    where: { phone },
    update: {
      totalOrders,
      delivered,
      returned,
      successRate: successRate.toFixed(2),
      riskLevel,
      courierData: couriers,
      ...errorData,
      checkedAt,
      expiresAt,
    },
    create: {
      phone,
      totalOrders,
      delivered,
      returned,
      successRate: successRate.toFixed(2),
      riskLevel,
      courierData: couriers,
      ...errorData,
      checkedAt,
      expiresAt,
    },
  })
  );
}
