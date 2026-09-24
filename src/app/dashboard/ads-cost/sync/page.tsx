import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  getBangladeshDateInputValue,
  getBangladeshDayRange,
} from "@/lib/bangladesh-time";
import AdsCostSyncClient from "./sync-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    accountId?: string;
    connected?: string;
    accounts?: string;
    error?: string;
  }>;
};

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function AdsCostSyncPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  const yesterday = shiftDate(today, -1);
  const from = validDate(params.from || "") ? String(params.from) : yesterday;
  const to = validDate(params.to || "") ? String(params.to) : yesterday;
  const accountId = String(params.accountId || "").trim();

  const fromRange = getBangladeshDayRange(from);
  const toRange = getBangladeshDayRange(to);
  const { prisma } = await import("@/lib/prisma");

  const [parents, sources, connections, campaigns, syncRuns] =
    await Promise.all([
      prisma.productParent.findMany({
        where: { status: true },
        orderBy: { sku: "asc" },
        select: { id: true, sku: true, name: true },
      }),
      prisma.orderSource.findMany({
        where: { status: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.metaAdsConnection.findMany({
        include: {
          accounts: {
            orderBy: { name: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.metaCampaign.findMany({
        where: {
          ...(accountId ? { adAccountId: accountId } : {}),
        },
        include: {
          adAccount: true,
          mapping: {
            include: {
              productParent: true,
              sources: {
                include: { source: true },
              },
            },
          },
          dailySpends: {
            where: {
              spendDate: {
                gte: fromRange.start,
                lte: toRange.end,
              },
            },
            orderBy: { spendDate: "asc" },
          },
        },
        orderBy: [{ adAccount: { name: "asc" } }, { campaignName: "asc" }],
      }),
      prisma.metaAdsSyncRun.findMany({
        include: {
          adAccount: {
            select: { name: true, metaAccountId: true },
          },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
    ]);

  const mappedCampaigns = campaigns.filter(
    (campaign) => campaign.mapping && campaign.mapping.sources.length
  );
  const allSourceIds = Array.from(
    new Set(
      mappedCampaigns.flatMap((campaign) =>
        campaign.mapping!.sources.map((item) => item.sourceId)
      )
    )
  );
  const allParentIds = Array.from(
    new Set(
      mappedCampaigns.map((campaign) => campaign.mapping!.productParentId)
    )
  );

  const orders =
    allSourceIds.length && allParentIds.length
      ? await prisma.order.findMany({
          where: {
            orderKind: "NORMAL",
            createdAt: {
              gte: fromRange.start,
              lte: toRange.end,
            },
            sourceId: { in: allSourceIds },
            items: {
              some: {
                product: {
                  parentId: { in: allParentIds },
                },
              },
            },
          },
          select: {
            id: true,
            sourceId: true,
            orderStatus: true,
            items: {
              select: {
                product: {
                  select: {
                    parentId: true,
                  },
                },
              },
            },
          },
        })
      : [];

  const campaignRows = campaigns.map((campaign) => {
    const mapping = campaign.mapping;
    const sourceIds = new Set(
      mapping?.sources.map((item) => item.sourceId) || []
    );

    const matchingOrders = mapping
      ? orders.filter(
          (order) =>
            sourceIds.has(order.sourceId) &&
            order.items.some(
              (item) => item.product?.parentId === mapping.productParentId
            )
        )
      : [];

    const totalOrders = matchingOrders.length;
    const confirmed = matchingOrders.filter(
      (order) => order.orderStatus === "READY_TO_SHIP"
    ).length;
    const cancelled = matchingOrders.filter(
      (order) => order.orderStatus === "CANCELLED"
    ).length;
    const noAnswer = matchingOrders.filter(
      (order) => order.orderStatus === "NO_ANSWER"
    ).length;
    const phoneOff = matchingOrders.filter(
      (order) => order.orderStatus === "PHONE_OFF"
    ).length;
    const spend = campaign.dailySpends.reduce(
      (sum, row) => sum + Number(row.amountSpent),
      0
    );

    return {
      id: campaign.id,
      metaCampaignId: campaign.metaCampaignId,
      campaignName: campaign.campaignName,
      account: {
        id: campaign.adAccount.id,
        metaAccountId: campaign.adAccount.metaAccountId,
        name: campaign.adAccount.name,
        currency: campaign.adAccount.currency,
      },
      spend,
      mapping: mapping
        ? {
            productParentId: mapping.productParentId,
            productParent: {
              sku: mapping.productParent.sku,
              name: mapping.productParent.name,
            },
            sourceIds: mapping.sources.map((item) => item.sourceId),
            sources: mapping.sources.map((item) => ({
              id: item.source.id,
              name: item.source.name,
            })),
          }
        : null,
      metrics: {
        totalOrders,
        confirmed,
        cancelled,
        noAnswer,
        phoneOff,
        confirmationRate: totalOrders > 0 ? (confirmed / totalOrders) * 100 : 0,
        costPerTotalOrder: totalOrders > 0 ? spend / totalOrders : 0,
        costPerConfirmed: confirmed > 0 ? spend / confirmed : 0,
      },
    };
  });

  const totalSpendByCurrency = new Map<string, number>();
  for (const row of campaignRows) {
    totalSpendByCurrency.set(
      row.account.currency,
      (totalSpendByCurrency.get(row.account.currency) || 0) + row.spend
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Ads Cost Sync</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect Meta ad accounts, sync daily campaign spend, and map each campaign to one Product Parent and multiple OMS Sources.
        </p>
      </section>

      <AdsCostSyncClient
        configured={Boolean(
          process.env.META_ADS_APP_ID?.trim() &&
            process.env.META_ADS_APP_SECRET?.trim()
        )}
        from={from}
        to={to}
        selectedAccountId={accountId}
        flash={{
          connected: params.connected === "1",
          accounts: Number(params.accounts || 0),
          error: params.error || "",
        }}
        parents={parents}
        sources={sources}
        connections={connections.map((connection) => ({
          id: connection.id,
          metaUserName: connection.metaUserName,
          metaUserId: connection.metaUserId,
          status: connection.status,
          tokenExpiresAt: connection.tokenExpiresAt?.toISOString() || null,
          lastSyncAt: connection.lastSyncAt?.toISOString() || null,
          lastSyncStatus: connection.lastSyncStatus,
          lastSyncMessage: connection.lastSyncMessage,
          accounts: connection.accounts.map((account) => ({
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.name,
            currency: account.currency,
            timezoneName: account.timezoneName,
            enabled: account.enabled,
            lastSyncAt: account.lastSyncAt?.toISOString() || null,
            lastSyncStatus: account.lastSyncStatus,
            lastSyncMessage: account.lastSyncMessage,
          })),
        }))}
        campaigns={campaignRows}
        summary={{
          totalAccounts: connections.reduce(
            (sum, connection) => sum + connection.accounts.length,
            0
          ),
          enabledAccounts: connections.reduce(
            (sum, connection) =>
              sum + connection.accounts.filter((account) => account.enabled).length,
            0
          ),
          campaigns: campaigns.length,
          mapped: mappedCampaigns.length,
          unmapped: campaigns.length - mappedCampaigns.length,
          spends: Array.from(totalSpendByCurrency.entries()).map(
            ([currency, amount]) => ({ currency, amount })
          ),
        }}
        syncRuns={syncRuns.map((run) => ({
          id: run.id,
          accountName: run.adAccount?.name || "Deleted / All",
          metaAccountId: run.adAccount?.metaAccountId || null,
          mode: run.mode,
          fromDate: run.fromDate,
          toDate: run.toDate,
          status: run.status,
          campaignsSeen: run.campaignsSeen,
          rowsSynced: run.rowsSynced,
          message: run.message,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() || null,
        }))}
      />
    </div>
  );
}
