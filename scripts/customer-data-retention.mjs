import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1000;

const DELETED_CUSTOMER_NAME = "[deleted after retention period]";
const DELETED_PHONE = "[deleted]";
const DELETED_ADDRESS = "[deleted after retention period]";

function readInteger(name, fallback, { min, max }) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}.`
    );
  }

  return value;
}

function readExecuteMode() {
  return process.env.CUSTOMER_DATA_RETENTION_EXECUTE
    ?.trim()
    .toLowerCase() === "true";
}

function createCutoff(retentionDays) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff;
}

function createEligibleWhere(cutoff) {
  return {
    createdAt: {
      lt: cutoff,
    },
    phone: {
      not: DELETED_PHONE,
    },
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const retentionDays = readInteger(
    "CUSTOMER_DATA_RETENTION_DAYS",
    DEFAULT_RETENTION_DAYS,
    { min: 30, max: 3650 }
  );

  const batchSize = readInteger(
    "CUSTOMER_DATA_RETENTION_BATCH_SIZE",
    DEFAULT_BATCH_SIZE,
    { min: 1, max: MAX_BATCH_SIZE }
  );

  const execute = readExecuteMode();
  const cutoff = createCutoff(retentionDays);

  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

  try {
    const eligibleWhere = createEligibleWhere(cutoff);

    const eligibleCount = await prisma.order.count({
      where: eligibleWhere,
    });

    console.log(
      `[data-retention] Mode: ${execute ? "EXECUTE" : "DRY RUN"}`
    );
    console.log(
      `[data-retention] Retention: ${retentionDays} days`
    );
    console.log(
      `[data-retention] Cutoff (UTC): ${cutoff.toISOString()}`
    );
    console.log(
      `[data-retention] Eligible orders: ${eligibleCount}`
    );

    if (!execute) {
      console.log(
        "[data-retention] No records changed. Set CUSTOMER_DATA_RETENTION_EXECUTE=true to enable anonymization."
      );
      return;
    }

    if (eligibleCount === 0) {
      console.log("[data-retention] Nothing to anonymize.");
      return;
    }

    let totalAnonymized = 0;

    while (true) {
      const batch = await prisma.order.findMany({
        where: createEligibleWhere(cutoff),
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        take: batchSize,
        select: {
          id: true,
        },
      });

      if (batch.length === 0) {
        break;
      }

      const ids = batch.map((order) => order.id);

      const updateResult = await prisma.order.updateMany({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          customerName: DELETED_CUSTOMER_NAME,
          phone: DELETED_PHONE,
          address: DELETED_ADDRESS,

          // Notes can contain customer instructions or other free-text PII.
          note: null,

          // Checkout idempotency tokens are no longer operationally needed
          // once an order is beyond the retention window.
          checkoutRequestId: null,

          // Keep Meta delivery status/timestamps/event IDs for aggregate audit,
          // but remove provider response/error bodies after the retention window.
          metaPurchaseError: null,
          metaPurchaseResponse: null,
        },
      });

      totalAnonymized += updateResult.count;

      console.log(
        `[data-retention] Anonymized ${updateResult.count} order(s); total ${totalAnonymized}/${eligibleCount}.`
      );

      if (updateResult.count === 0) {
        throw new Error(
          "Retention worker made no progress while eligible records remained."
        );
      }
    }

    console.log(
      `[data-retention] Complete. Anonymized ${totalAnonymized} order(s).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[data-retention] Failed:", error);
  process.exitCode = 1;
});
