import { decryptSecret } from "@/lib/shop-settings-crypto";
import { getCampaignInsights } from "./client";

type SyncMode = "MANUAL" | "AUTO";

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD.");
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) throw new Error("Invalid sync date.");
  return date;
}

function validateRange(fromDate: string, toDate: string) {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days < 1) throw new Error("From date cannot be after To date.");
  if (days > 31) throw new Error("Meta Ads sync is limited to 31 days per run.");
}

function tokenFromConnection(connection: {
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenTag: string;
  tokenExpiresAt: Date | null;
}) {
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now() + 60000) {
    throw new Error("Meta access token has expired. Reconnect Meta.");
  }
  return decryptSecret({
    encrypted: connection.accessTokenEncrypted,
    iv: connection.accessTokenIv,
    tag: connection.accessTokenTag,
  });
}

async function syncOneAccount(input: {
  account: any;
  fromDate: string;
  toDate: string;
  mode: SyncMode;
}) {
  const { prisma } = await import("@/lib/prisma");
  const run = await prisma.metaAdsSyncRun.create({
    data: {
      adAccountId: input.account.id,
      mode: input.mode,
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: "RUNNING",
    },
  });

  try {
    const rows = await getCampaignInsights({
      accessToken: tokenFromConnection(input.account.connection),
      metaAccountId: input.account.metaAccountId,
      fromDate: input.fromDate,
      toDate: input.toDate,
    });

    const validRows = rows.filter(
      (row) =>
        row.campaign_id &&
        row.campaign_name &&
        row.date_start &&
        Number.isFinite(Number(row.spend || 0))
    );
    const uniqueCampaigns = new Set(validRows.map((row) => String(row.campaign_id)));

    await prisma.$transaction(async (tx) => {
      await tx.metaDailySpend.deleteMany({
        where: {
          adAccountId: input.account.id,
          spendDate: { gte: parseDate(input.fromDate), lte: parseDate(input.toDate) },
        },
      });

      for (const row of validRows) {
        const metaCampaignId = String(row.campaign_id);
        const campaignName = String(row.campaign_name);
        const campaign = await tx.metaCampaign.upsert({
          where: {
            adAccountId_metaCampaignId: {
              adAccountId: input.account.id,
              metaCampaignId,
            },
          },
          create: {
            adAccountId: input.account.id,
            metaCampaignId,
            campaignName,
            lastSeenAt: new Date(),
          },
          update: { campaignName, lastSeenAt: new Date() },
        });

        await tx.metaDailySpend.create({
          data: {
            adAccountId: input.account.id,
            campaignId: campaign.id,
            spendDate: parseDate(String(row.date_start)),
            amountSpent: Number(row.spend || 0),
            currency: input.account.currency || "USD",
            campaignNameSnapshot: campaignName,
            syncedAt: new Date(),
          },
        });
      }
    });

    const message =
      validRows.length +
      " daily campaign spend row(s) synced from Meta for " +
      input.account.name +
      ".";

    await prisma.$transaction([
      prisma.metaAdsSyncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          campaignsSeen: uniqueCampaigns.size,
          rowsSynced: validRows.length,
          message,
          finishedAt: new Date(),
        },
      }),
      prisma.metaAdAccount.update({
        where: { id: input.account.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncMessage: message,
        },
      }),
    ]);

    return {
      accountId: input.account.id,
      accountName: input.account.name,
      success: true,
      campaignsSeen: uniqueCampaigns.size,
      rowsSynced: validRows.length,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta Ads sync failed.";
    await prisma.$transaction([
      prisma.metaAdsSyncRun.update({
        where: { id: run.id },
        data: { status: "FAILED", message, finishedAt: new Date() },
      }),
      prisma.metaAdAccount.update({
        where: { id: input.account.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: "FAILED", lastSyncMessage: message },
      }),
    ]).catch(() => undefined);

    return {
      accountId: input.account.id,
      accountName: input.account.name,
      success: false,
      campaignsSeen: 0,
      rowsSynced: 0,
      message,
    };
  }
}

export async function syncMetaAdsRange(input: {
  fromDate: string;
  toDate: string;
  mode: SyncMode;
  accountId?: string;
}) {
  validateRange(input.fromDate, input.toDate);
  const { prisma } = await import("@/lib/prisma");
  const accounts = await prisma.metaAdAccount.findMany({
    where: {
      enabled: true,
      ...(input.accountId ? { id: input.accountId } : {}),
      connection: { status: true },
    },
    include: { connection: true },
    orderBy: { name: "asc" },
  });

  if (!accounts.length) {
    return { results: [], successCount: 0, failureCount: 0, message: "No enabled Meta ad accounts are connected." };
  }

  const results = [];
  for (const account of accounts) {
    results.push(
      await syncOneAccount({
        account,
        fromDate: input.fromDate,
        toDate: input.toDate,
        mode: input.mode,
      })
    );
  }

  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;
  const connectionIds = Array.from(new Set(accounts.map((account) => account.connectionId)));

  for (const connectionId of connectionIds) {
    const accountIds = new Set(
      accounts.filter((account) => account.connectionId === connectionId).map((account) => account.id)
    );
    const connectedResults = results.filter((result) => accountIds.has(result.accountId));
    const failed = connectedResults.filter((result) => !result.success);
    const message = failed.length
      ? failed.map((result) => result.accountName + ": " + result.message).join(" | ")
      : connectedResults.map((result) => result.accountName + ": " + result.rowsSynced + " row(s)").join(" | ");

    await prisma.metaAdsConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: failed.length ? "PARTIAL_OR_FAILED" : "SUCCESS",
        lastSyncMessage: message,
      },
    });
  }

  return {
    results,
    successCount,
    failureCount,
    message: successCount + " account(s) synced successfully; " + failureCount + " failed.",
  };
}
