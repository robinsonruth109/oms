export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import AdsCostPerformanceTable from "./performance-table";

const ALL_PAGE_ORDER = "__ALL_PAGE_ORDER__";
const ALL_WEB_ORDER = "__ALL_WEB_ORDER__";

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    sourceId?: string;
    adAccountId?: string;
    dataSource?: string;
  }>;
};

type ReportChildRow = {
  id: string;
  campaignName: string;
  adAccountName: string;
  adAccountId: string;
  currency: string;
  spendAmount: number;
  spendBdt: number;
  dollarRate: number;
  metaPurchases: number;
};

type ReportRow = {
  id: string;
  dataSource: "META" | "CSV";
  productParentId: string;
  parentSku: string;
  parentName: string;
  campaignName: string;
  adAccountName: string;
  adAccountId: string;
  currency: string;
  sourceNames: string[];
  sourceIds: string[];
  spendAmount: number;
  spendUsd: number;
  spendBdt: number;
  dollarRate: number;
  purchasePrice: number;
  totalOrders: number;
  confirmed: number;
  cancelled: number;
  noAnswer: number;
  phoneOff: number;
  confirmationRate: number;
  costPerOrderBdt: number;
  costPerConfirmedBdt: number;
  orderIds: string[];
  confirmedOrderIds: string[];
  isGroup: boolean;
  metaPurchases: number | null;
  children: ReportChildRow[];
};

function money(value: number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

function usd(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

function currencyAmount(value: number, currency: string) {
  const code = currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${code} ${Number(value || 0).toFixed(2)}`;
  }
}

function getSelectedSourceIds(
  sourceId: string,
  sources: { id: string; type: string }[]
) {
  if (sourceId === ALL_PAGE_ORDER) {
    return sources
      .filter((source) => source.type === "MANUAL")
      .map((source) => source.id);
  }

  if (sourceId === ALL_WEB_ORDER) {
    return sources
      .filter(
        (source) => source.type === "SHOPIFY" || source.type === "LARAVEL"
      )
      .map((source) => source.id);
  }

  return sourceId ? [sourceId] : [];
}

function buildStatusMetrics(
  orders: {
    id: string;
    orderStatus: string;
  }[]
) {
  const totalOrders = orders.length;
  const confirmed = orders.filter(
    (order) => order.orderStatus === "READY_TO_SHIP"
  ).length;
  const cancelled = orders.filter(
    (order) => order.orderStatus === "CANCELLED"
  ).length;
  const noAnswer = orders.filter(
    (order) => order.orderStatus === "NO_ANSWER"
  ).length;
  const phoneOff = orders.filter(
    (order) => order.orderStatus === "PHONE_OFF"
  ).length;

  return {
    totalOrders,
    confirmed,
    cancelled,
    noAnswer,
    phoneOff,
    confirmationRate:
      totalOrders > 0 ? (confirmed / totalOrders) * 100 : 0,
  };
}

export default async function AdsCostReportPage({
  searchParams,
}: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const sourceId = (params.sourceId || "").trim();
  const adAccountId = (params.adAccountId || "").trim();
  const dataSource =
    String(params.dataSource || "META").toUpperCase() === "CSV"
      ? "CSV"
      : "META";

  const fromDate = bangladeshDateStartUtc(from);
  const toDate = bangladeshDateEndUtc(to);

  const [sources, adAccounts, dollarRates, receivedOrders, products] =
    await Promise.all([
      prisma.orderSource.findMany({
        where: { status: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
        },
      }),
      prisma.metaAdAccount.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          metaAccountId: true,
          name: true,
          currency: true,
        },
      }),
      prisma.dailyDollarRate.findMany({
        where: {
          rateDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { rateDate: "asc" },
      }),
      prisma.purchaseReceivedOrder.findMany({
        where: {
          receiveDate: {
            lte: toDate,
          },
        },
        include: {
          purchaseOrder: true,
        },
      }),
      prisma.product.findMany({
        where: { status: true },
        include: {
          parent: true,
        },
      }),
    ]);

  const selectedSourceIds = getSelectedSourceIds(sourceId, sources);
  const selectedSourceIdSet = new Set(selectedSourceIds);

  const dollarRateMap = new Map<
    string,
    {
      totalUsd: number;
      totalBdt: number;
      averageRate: number;
    }
  >();

  for (const rate of dollarRates) {
    const dateKey = getBangladeshDateInputValue(rate.rateDate);
    const current = dollarRateMap.get(dateKey) || {
      totalUsd: 0,
      totalBdt: 0,
      averageRate: 0,
    };

    current.totalUsd += Number(rate.usdAmount);
    current.totalBdt += Number(rate.bdtAmount);
    current.averageRate =
      current.totalUsd > 0 ? current.totalBdt / current.totalUsd : 0;

    dollarRateMap.set(dateKey, current);
  }

  const originalCostMap = new Map<
    string,
    {
      totalQty: number;
      totalCost: number;
    }
  >();

  for (const received of receivedOrders) {
    const parentSku = received.purchaseOrder.parentSku;
    const current = originalCostMap.get(parentSku) || {
      totalQty: 0,
      totalCost: 0,
    };

    current.totalQty += Number(received.receivedQty);
    current.totalCost += Number(received.grandTotalBdt);

    originalCostMap.set(parentSku, current);
  }

  const fallbackPriceMap = new Map<
    string,
    {
      totalQty: number;
      totalPrice: number;
    }
  >();

  for (const product of products) {
    const parentSku = product.parent.sku;
    const current = fallbackPriceMap.get(parentSku) || {
      totalQty: 0,
      totalPrice: 0,
    };

    current.totalQty += Number(product.quantity || 1);
    current.totalPrice += Number(product.purchasePrice);

    fallbackPriceMap.set(parentSku, current);
  }

  function purchasePriceFor(parentSku: string) {
    const originalCost = originalCostMap.get(parentSku);
    const fallbackPrice = fallbackPriceMap.get(parentSku);

    if (originalCost && originalCost.totalQty > 0) {
      return originalCost.totalCost / originalCost.totalQty;
    }

    if (fallbackPrice && fallbackPrice.totalQty > 0) {
      return fallbackPrice.totalPrice / fallbackPrice.totalQty;
    }

    return 0;
  }

  const rows: ReportRow[] = [];

  if (dataSource === "META") {
    const campaigns = await prisma.metaCampaign.findMany({
      where: {
        ...(adAccountId ? { adAccountId } : {}),
        dailySpends: {
          some: {
            spendDate: {
              gte: fromDate,
              lte: toDate,
            },
          },
        },
      },
      include: {
        adAccount: true,
        mapping: {
          include: {
            productParent: true,
            sources: {
              include: {
                source: true,
              },
            },
          },
        },
        dailySpends: {
          where: {
            spendDate: {
              gte: fromDate,
              lte: toDate,
            },
          },
          orderBy: {
            spendDate: "asc",
          },
        },
      },
      orderBy: [{ adAccount: { name: "asc" } }, { campaignName: "asc" }],
    });

    const eligibleCampaigns = campaigns.filter((campaign) => {
      if (!campaign.mapping || !campaign.mapping.sources.length) {
        return false;
      }

      if (!selectedSourceIds.length) {
        return true;
      }

      // Source filtering only decides which mapped campaigns are shown.
      // The campaign calculation still merges ALL sources in that campaign
      // so the same Meta spend is never split or duplicated by source.
      return campaign.mapping.sources.some((item) =>
        selectedSourceIdSet.has(item.sourceId)
      );
    });

    const parentIds = Array.from(
      new Set(
        eligibleCampaigns.map(
          (campaign) => campaign.mapping!.productParentId
        )
      )
    );

    const mappedSourceIds = Array.from(
      new Set(
        eligibleCampaigns.flatMap((campaign) =>
          campaign.mapping!.sources.map((item) => item.sourceId)
        )
      )
    );

    const orders =
      parentIds.length && mappedSourceIds.length
        ? await prisma.order.findMany({
            where: {
              orderKind: "NORMAL",
              createdAt: {
                gte: fromDate,
                lte: toDate,
              },
              sourceId: {
                in: mappedSourceIds,
              },
              items: {
                some: {
                  product: {
                    parentId: {
                      in: parentIds,
                    },
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

    type EligibleCampaign = (typeof eligibleCampaigns)[number];

    const reportUnits = new Map<string, EligibleCampaign[]>();

    for (const campaign of eligibleCampaigns) {
      const mapping = campaign.mapping!;
      const signature =
        mapping.productParentId +
        "::" +
        mapping.sources
          .map((item) => item.sourceId)
          .sort()
          .join(",");

      const unitKey = mapping.reportGroupId
        ? `GROUP__${mapping.reportGroupId}__${signature}`
        : `CAMPAIGN__${campaign.id}`;

      const unit = reportUnits.get(unitKey) || [];
      unit.push(campaign);
      reportUnits.set(unitKey, unit);
    }

    function campaignSpend(campaign: EligibleCampaign) {
      let spendAmount = 0;
      let spendUsd = 0;
      let spendBdt = 0;
      let metaPurchases = 0;

      for (const spend of campaign.dailySpends) {
        const amountSpent = Number(spend.amountSpent);
        spendAmount += amountSpent;
        metaPurchases += Number(spend.metaPurchases || 0);

        if (String(spend.currency).toUpperCase() === "USD") {
          spendUsd += amountSpent;
          const dateKey = getBangladeshDateInputValue(spend.spendDate);
          const rate = dollarRateMap.get(dateKey)?.averageRate || 0;
          spendBdt += amountSpent * rate;
        }
      }

      return {
        spendAmount,
        spendUsd,
        spendBdt,
        metaPurchases,
        dollarRate: spendUsd > 0 ? spendBdt / spendUsd : 0,
      };
    }

    for (const [unitKey, unitCampaigns] of reportUnits) {
      const firstCampaign = unitCampaigns[0];
      const mapping = firstCampaign.mapping!;
      const campaignSourceIds = new Set(
        mapping.sources.map((item) => item.sourceId)
      );

      const matchingOrders = orders.filter(
        (order) =>
          campaignSourceIds.has(order.sourceId) &&
          order.items.some(
            (item) => item.product?.parentId === mapping.productParentId
          )
      );

      const status = buildStatusMetrics(matchingOrders);
      const childRows: ReportChildRow[] = unitCampaigns.map((campaign) => {
        const spend = campaignSpend(campaign);

        return {
          id: campaign.id,
          campaignName: campaign.campaignName,
          adAccountName: campaign.adAccount.name,
          adAccountId: campaign.adAccount.metaAccountId,
          currency: campaign.adAccount.currency || "USD",
          spendAmount: spend.spendAmount,
          spendBdt: spend.spendBdt,
          dollarRate: spend.dollarRate,
          metaPurchases: spend.metaPurchases,
        };
      });

      const spendAmount = childRows.reduce(
        (sum, child) => sum + child.spendAmount,
        0
      );
      const spendUsd = unitCampaigns.reduce(
        (sum, campaign) => sum + campaignSpend(campaign).spendUsd,
        0
      );
      const spendBdt = childRows.reduce(
        (sum, child) => sum + child.spendBdt,
        0
      );
      const isGroup = childRows.length > 1;
      const uniqueAccountNames = Array.from(
        new Set(childRows.map((child) => child.adAccountName))
      );
      const uniqueAccountIds = Array.from(
        new Set(childRows.map((child) => child.adAccountId))
      );
      const campaignName = isGroup
        ? childRows.length <= 3
          ? childRows.map((child) => child.campaignName).join(" & ")
          : childRows
              .slice(0, 2)
              .map((child) => child.campaignName)
              .join(" & ") +
            ` & +${childRows.length - 2} more`
        : firstCampaign.campaignName;

      rows.push({
        id: `META__${unitKey}`,
        dataSource: "META",
        productParentId: mapping.productParentId,
        parentSku: mapping.productParent.sku,
        parentName: mapping.productParent.name,
        campaignName,
        adAccountName: uniqueAccountNames.join(", "),
        adAccountId: uniqueAccountIds.join(", "),
        currency: firstCampaign.adAccount.currency || "USD",
        sourceNames: mapping.sources.map((item) => item.source.name),
        sourceIds: mapping.sources.map((item) => item.sourceId),
        spendAmount,
        spendUsd,
        spendBdt,
        dollarRate: spendUsd > 0 ? spendBdt / spendUsd : 0,
        purchasePrice: purchasePriceFor(mapping.productParent.sku),
        ...status,
        costPerOrderBdt:
          status.totalOrders > 0 ? spendBdt / status.totalOrders : 0,
        costPerConfirmedBdt:
          status.confirmed > 0 ? spendBdt / status.confirmed : 0,
        orderIds: matchingOrders.map((order) => order.id),
        confirmedOrderIds: matchingOrders
          .filter((order) => order.orderStatus === "READY_TO_SHIP")
          .map((order) => order.id),
        isGroup,
        metaPurchases: isGroup
          ? null
          : childRows[0]?.metaPurchases || 0,
        children: isGroup ? childRows : [],
      });
    }
  } else {
    const csvSourceIds =
      selectedSourceIds.length > 0 ? selectedSourceIds : undefined;

    const adsItems = await prisma.adsCostItem.findMany({
      where: {
        ...(csvSourceIds
          ? {
              sourceId: {
                in: csvSourceIds,
              },
            }
          : {}),
        upload: {
          uploadDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      include: {
        productParent: true,
        source: true,
        upload: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const parentIds = Array.from(
      new Set(adsItems.map((item) => item.productParentId))
    );
    const csvMappedSourceIds = Array.from(
      new Set(adsItems.map((item) => item.sourceId))
    );

    const orders =
      parentIds.length && csvMappedSourceIds.length
        ? await prisma.order.findMany({
            where: {
              orderKind: "NORMAL",
              createdAt: {
                gte: fromDate,
                lte: toDate,
              },
              sourceId: {
                in: csvMappedSourceIds,
              },
              items: {
                some: {
                  product: {
                    parentId: {
                      in: parentIds,
                    },
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

    const csvMap = new Map<
      string,
      {
        productParentId: string;
        parentSku: string;
        parentName: string;
        sourceId: string;
        sourceName: string;
        campaignName: string;
        spendUsd: number;
        spendBdt: number;
      }
    >();

    for (const item of adsItems) {
      const key = `${item.productParentId}__${item.sourceId}__${item.campaignName}`;
      const dateKey = getBangladeshDateInputValue(item.upload.uploadDate);
      const rate = dollarRateMap.get(dateKey)?.averageRate || 0;
      const itemSpendUsd = Number(item.amountSpent);
      const itemSpendBdt = itemSpendUsd * rate;

      const existing = csvMap.get(key);

      if (existing) {
        existing.spendUsd += itemSpendUsd;
        existing.spendBdt += itemSpendBdt;
      } else {
        csvMap.set(key, {
          productParentId: item.productParentId,
          parentSku: item.productParent.sku,
          parentName: item.productParent.name,
          sourceId: item.sourceId,
          sourceName: item.source.name,
          campaignName: item.campaignName,
          spendUsd: itemSpendUsd,
          spendBdt: itemSpendBdt,
        });
      }
    }

    for (const [key, item] of csvMap) {
      const matchingOrders = orders.filter(
        (order) =>
          order.sourceId === item.sourceId &&
          order.items.some(
            (orderItem) =>
              orderItem.product?.parentId === item.productParentId
          )
      );

      const status = buildStatusMetrics(matchingOrders);

      rows.push({
        id: `CSV__${key}`,
        dataSource: "CSV",
        productParentId: item.productParentId,
        parentSku: item.parentSku,
        parentName: item.parentName,
        campaignName: item.campaignName,
        adAccountName: "CSV Upload",
        adAccountId: "",
        currency: "USD",
        sourceNames: [item.sourceName],
        sourceIds: [item.sourceId],
        spendAmount: item.spendUsd,
        spendUsd: item.spendUsd,
        spendBdt: item.spendBdt,
        dollarRate:
          item.spendUsd > 0 ? item.spendBdt / item.spendUsd : 0,
        purchasePrice: purchasePriceFor(item.parentSku),
        ...status,
        costPerOrderBdt:
          status.totalOrders > 0
            ? item.spendBdt / status.totalOrders
            : 0,
        costPerConfirmedBdt:
          status.confirmed > 0
            ? item.spendBdt / status.confirmed
            : 0,
        orderIds: matchingOrders.map((order) => order.id),
        confirmedOrderIds: matchingOrders
          .filter((order) => order.orderStatus === "READY_TO_SHIP")
          .map((order) => order.id),
        isGroup: false,
        metaPurchases: null,
        children: [],
      });
    }
  }

  rows.sort((a, b) => b.spendBdt - a.spendBdt);

  const totalAdsUsd = rows.reduce(
    (sum, row) => sum + row.spendUsd,
    0
  );
  const totalAdsBdt = rows.reduce(
    (sum, row) => sum + row.spendBdt,
    0
  );

  const uniqueOrderIds = new Set(
    rows.flatMap((row) => row.orderIds)
  );
  const uniqueConfirmedOrderIds = new Set(
    rows.flatMap((row) => row.confirmedOrderIds)
  );

  const totalOrders = uniqueOrderIds.size;
  const confirmedOrders = uniqueConfirmedOrderIds.size;
  const confirmationRate =
    totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0;
  const averageCostPerOrderBdt =
    totalOrders > 0 ? totalAdsBdt / totalOrders : 0;
  const averageCostPerConfirmedBdt =
    confirmedOrders > 0 ? totalAdsBdt / confirmedOrders : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Ads Cost Report
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Meta campaign spend matched with OMS orders by mapped Product Parent
          and Sources. Campaign spend is counted once; mapped Sources are
          combined for order costing.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cost Source
            </label>
            <select
              name="dataSource"
              defaultValue={dataSource}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="META">Meta Sync</option>
              <option value="CSV">CSV Upload</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Source
            </label>
            <select
              name="sourceId"
              defaultValue={sourceId}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Sources</option>
              <option value={ALL_PAGE_ORDER}>All Page Order</option>
              <option value={ALL_WEB_ORDER}>All Web Order</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Meta Ad Account
            </label>
            <div className="flex gap-2">
              <select
                name="adAccountId"
                defaultValue={adAccountId}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
              >
                <option value="">All Ad Accounts</option>
                {adAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.metaAccountId})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </form>

        {dataSource === "META" && sourceId ? (
          <p className="mt-3 text-xs text-slate-500">
            Source filtering finds campaigns mapped to that Source/group. Cost
            calculations still use every Source mapped to each campaign, so
            Meta spend is never split or duplicated.
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Summary title="Ads Spend USD" value={usd(totalAdsUsd)} />
        <Summary title="Ads Spend BDT" value={money(totalAdsBdt)} />
        <Summary title="Total Orders" value={String(totalOrders)} />
        <Summary title="Confirmed" value={String(confirmedOrders)} />
        <Summary
          title="Confirmation Rate"
          value={`${confirmationRate.toFixed(2)}%`}
        />
        <Summary
          title="Cost / Order BDT"
          value={money(averageCostPerOrderBdt)}
        />
        <Summary
          title="Cost / Confirmed BDT"
          value={money(averageCostPerConfirmedBdt)}
        />
      </section>

      <AdsCostPerformanceTable rows={rows} dataSource={dataSource} />

      {dataSource === "META" ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          Connected campaigns share one OMS order pool in the parent row, so
          orders are not duplicated. Expand a connected row to see each Meta
          campaign&apos;s own spend and attributed Meta Purchases.
        </section>
      ) : null}
    </div>
  );
}

function Summary({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-sm text-slate-700 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}
