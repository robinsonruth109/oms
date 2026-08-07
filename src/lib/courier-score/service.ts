import { withDatabaseRetry } from "@/lib/database-retry";

import { readFreshCourierScore, saveCourierScore } from "./cache";
import { decryptCourierCredential, isCourierCredentialConfigured } from "./credentials";
import { assertBangladeshPhone } from "./phone";
import type { CourierProvider, CourierStats, CustomerCourierScoreResult } from "./types";
import {
  fetchPathaoCustomerStats,
  fetchRedXCustomerStats,
  fetchSteadfastCustomerStats,
} from "./adapters/customer-stats";

function serializeScore(row: {
  phone: string;
  totalOrders: number;
  delivered: number;
  returned: number;
  successRate: { toString(): string };
  riskLevel: "NEW_CUSTOMER" | "LOW" | "MEDIUM" | "HIGH";
  courierData: unknown;
  checkedAt: Date;
  expiresAt: Date;
}): CustomerCourierScoreResult {
  return {
    phone: row.phone,
    totalOrders: row.totalOrders,
    delivered: row.delivered,
    returned: row.returned,
    successRate: Number(row.successRate.toString()),
    riskLevel: row.riskLevel,
    couriers: Array.isArray(row.courierData) ? (row.courierData as CourierStats[]) : [],
    checkedAt: row.checkedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function getCachedCourierScore(phoneInput: unknown) {
  const cached = await readFreshCourierScore(phoneInput);
  return cached ? serializeScore(cached) : null;
}

export async function checkCustomerCourierScore(
  phoneInput: unknown,
  options?: { forceRefresh?: boolean }
): Promise<CustomerCourierScoreResult> {
  const phone = assertBangladeshPhone(phoneInput);

  if (!options?.forceRefresh) {
    const cached = await readFreshCourierScore(phone);
    if (cached) return serializeScore(cached);
  }

  const { prisma } = await import("@/lib/prisma");
  const credentialRows = await withDatabaseRetry(() =>
    prisma.courierCredential.findMany({
      where: { enabled: true },
    })
  );

  const configured = credentialRows.filter(isCourierCredentialConfigured);
  if (configured.length === 0) {
    throw new Error(
      "Courier Score ব্যবহার করতে Shop Settings থেকে অন্তত একটি connected courier Enable করুন।"
    );
  }

  const tasks = configured.map(async (row): Promise<CourierStats> => {
    const credential = decryptCourierCredential(row);
    const common = {
      username: credential.username,
      password: credential.password,
      phone,
    };

    if (row.provider === "PATHAO") return fetchPathaoCustomerStats(common);
    if (row.provider === "STEADFAST") return fetchSteadfastCustomerStats(common);
    return fetchRedXCustomerStats(common);
  });

  const fetched = await Promise.all(tasks);
  const enabledProviders = new Set(configured.map((row) => row.provider as CourierProvider));
  const orderedProviders: CourierProvider[] = ["PATHAO", "STEADFAST", "REDX"];

  const couriers = orderedProviders
    .filter((provider) => enabledProviders.has(provider))
    .map(
      (provider) =>
        fetched.find((item) => item.provider === provider) ?? {
          provider,
          total: 0,
          delivered: 0,
          returned: 0,
          successRate: 0,
          available: false,
          error: `${provider} result পাওয়া যায়নি।`,
        }
    );

  if (!couriers.some((courier) => courier.available)) {
    const message = couriers
      .map((courier) => courier.error)
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Courier history পাওয়া যায়নি।");
  }

  const saved = await saveCourierScore(phone, couriers);
  return serializeScore(saved);
}
