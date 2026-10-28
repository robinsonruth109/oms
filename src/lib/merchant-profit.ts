import "server-only";

import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  cogsForMerchantItem,
  normalizePathaoEvent,
  numberValue,
  rawNumber,
} from "@/lib/merchant-portal";

function dateEpoch(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function monthKeys(from: string, to: string) {
  const fromMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(from);
  const toMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(to);
  if (!fromMatch || !toMatch) return [] as string[];

  let year = Number(fromMatch[1]);
  let month = Number(fromMatch[2]);
  const endYear = Number(toMatch[1]);
  const endMonth = Number(toMatch[2]);
  const rows: string[] = [];

  while (year < endYear || (year === endYear && month <= endMonth)) {
    rows.push(String(year) + "-" + String(month).padStart(2, "0"));
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return rows;
}

function monthShare(month: string, from: string, to: string) {
  const parts = month.split("-").map(Number);
  const year = parts[0];
  const monthNo = parts[1];
  const days = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const first = Date.UTC(year, monthNo - 1, 1);
  const last = Date.UTC(year, monthNo - 1, days);
  const start = Math.max(first, dateEpoch(from));
  const end = Math.min(last, dateEpoch(to));
  const used = end >= start ? Math.floor((end - start) / 86400000) + 1 : 0;

  return { used, days, share: used / days };
}

export type MerchantProfitResult = {
  from: string;
  to: string;
  deliveredOrders: number;
  returnedOrders: number;
  pendingOrders: number;
  deliveredProductQty: number;
  realizedRevenue: number;
  productCogs: number;
  deliveryCost: number;
  returnCost: number;
  metaAds: number;
  metaAdsUsd: number;
  operatingCost: number;
  netProfit: number;
  netMargin: number;
  missingDollarRateDays: string[];
  unsupportedAdCurrencies: string[];
  operatingCostRows: {
    month: string;
    fullAmount: number;
    appliedAmount: number;
    daysUsed: number;
    daysInMonth: number;
  }[];
  adRows: {
    id: string;
    date: string;
    campaign: string;
    currency: string;
    nativeAmount: number;
    bdtAmount: number;
  }[];
  parentRows: {
    parentId: string;
    sku: string;
    name: string;
    qty: number;
    totalInvoices: number;
    deliveredInvoices: number;
    returnedInvoices: number;
    pendingInvoices: number;
    merchandiseSales: number;
    cogs: number;
    courierCost: number;
    adsCost: number;
    profit: number;
  }[];
};

export async function calculateMerchantProfitLoss(
  merchantId: string,
  from: string,
  to: string
): Promise<MerchantProfitResult> {
  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);
  const { prisma } = await import("@/lib/prisma");

  const merchantScope = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      couriers: { select: { courierId: true } },
      stockAllocations: {
        select: { productId: true, parentId: true },
      },
    },
  });
  const courierIds = Array.from(new Set((merchantScope?.couriers || []).map((row) => row.courierId)));
  const allocatedProductIds = Array.from(new Set((merchantScope?.stockAllocations || []).map((row) => row.productId)));
  const allocatedParentIds = Array.from(new Set((merchantScope?.stockAllocations || []).map((row) => row.parentId)));

  const [webhooks, dollarRates, adSpends, operatingCosts] = await Promise.all([
    prisma.pathaoWebhookEvent.findMany({
      where: {
        signatureValid: true,
        processed: true,
        orderId: { not: null },
        ...(courierIds.length ? { courierId: { in: courierIds } } : { courierId: "__NO_MERCHANT_COURIER__" }),
        order: {
          is: {
            readyToShipAt: { gte: start, lte: end },
            ...(allocatedProductIds.length
              ? { items: { some: { productId: { in: allocatedProductIds } } } }
              : { id: "__NO_ALLOCATED_PRODUCT__" }),
          },
        },
      },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        orderId: true,
        eventName: true,
        receivedAt: true,
        rawPayload: true,
      },
    }),
    prisma.dailyDollarRate.findMany({
      where: { rateDate: { gte: start, lte: end } },
      orderBy: { rateDate: "asc" },
      select: {
        rateDate: true,
        usdAmount: true,
        bdtAmount: true,
      },
    }),
    prisma.metaDailySpend.findMany({
      where: {
        spendDate: { gte: start, lte: end },
        campaign: {
          mapping: {
            is: {
              OR: [
                { merchantId },
                {
                  merchantAllocations: {
                    some: { merchantId, fromDate: from, toDate: to },
                  },
                },
              ],
            },
          },
        },
      },
      orderBy: [{ spendDate: "asc" }, { campaignNameSnapshot: "asc" }],
      select: {
        id: true,
        spendDate: true,
        amountSpent: true,
        currency: true,
        campaignNameSnapshot: true,
        campaign: {
          select: {
            id: true,
            mapping: {
              select: {
                productParentId: true,
                merchantId: true,
                merchantAllocations: {
                  where: { fromDate: from, toDate: to },
                  select: { merchantId: true, amountUsd: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.merchantOperatingCost.findMany({
      where: { merchantId },
      orderBy: { costMonth: "asc" },
      select: {
        costMonth: true,
        amount: true,
      },
    }),
  ]);

  const orderIds = Array.from(
    new Set(
      webhooks
        .map((row) => row.orderId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          totalAmount: true,
          advance: true,
          deliveryCharge: true,
          pathaoDeliveryFee: true,
          pathaoAmountToCollect: true,
          pathaoAuthorizedCodAmount: true,
          pathaoPaymentStatus: true,
          pathaoPaymentVerifiedAt: true,
          pathaoSettlementCollectedAmount: true,
          pathaoSettlementDeliveryFee: true,
          pathaoSettlementCodFee: true,
          pathaoSettlementTotalFee: true,
          items: {
            select: {
              id: true,
              quantity: true,
              lineTotal: true,
              productSku: true,
              productName: true,
              product: {
                select: {
                  id: true,
                  inventoryKind: true,
                  purchasePrice: true,
                  unitsPerSale: true,
                  parent: {
                    select: {
                      id: true,
                      sku: true,
                      name: true,
                      merchantId: true,
                      stockMode: true,
                      purchasePrice: true,
                    },
                  },
                  bundleComponents: {
                    select: {
                      units: true,
                      componentProduct: {
                        select: { purchasePrice: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];

  const orderMap = new Map(orders.map((row) => [row.id, row]));
  const eventMap = new Map<string, typeof webhooks>();

  for (const webhook of webhooks) {
    if (!webhook.orderId) continue;
    const current = eventMap.get(webhook.orderId) || [];
    current.push(webhook);
    eventMap.set(webhook.orderId, current);
  }

  let deliveredOrders = 0;
  let returnedOrders = 0;
  let pendingOrders = 0;
  let deliveredProductQty = 0;
  let realizedRevenue = 0;
  let productCogs = 0;
  let deliveryCost = 0;
  let returnCost = 0;

  const parentMap = new Map<string, MerchantProfitResult["parentRows"][number] & { invoiceIds: Set<string> }>();

  for (const [orderId, events] of eventMap) {
    const order = orderMap.get(orderId);
    if (!order) continue;

    let deliveredAt = -1;
    let returnedAt = -1;
    let deliveredPayload: unknown = null;
    let paidReturnCost = 0;

    for (const webhook of events) {
      const name = normalizePathaoEvent(webhook.eventName);
      const time = webhook.receivedAt.getTime();

      if (name === "order.delivered" || name === "delivered") {
        deliveredAt = Math.max(deliveredAt, time);
        deliveredPayload = webhook.rawPayload;
      }

      if (
        name === "order.returned" ||
        name === "order.return" ||
        name === "order.return-id-created" ||
        name === "order.return-in-transit" ||
        name === "order.returned-to-merchant" ||
        name === "order.paid-return" ||
        name === "returned" ||
        name === "return" ||
        name === "paid-return"
      ) {
        returnedAt = Math.max(returnedAt, time);
      }

      if (name === "order.paid-return" || name === "paid-return") {
        const fee = rawNumber(webhook.rawPayload, [
          "collected_amount",
          "return_charge",
          "return_fee",
        ]);
        if (fee !== null) paidReturnCost = Math.max(0, fee);
      }
    }

    const returned = returnedAt >= 0 && returnedAt >= deliveredAt;
    const delivered = deliveredAt >= 0 && deliveredAt > returnedAt;

    const merchantItems = order.items.filter(
      (item) => item.product?.id && allocatedProductIds.includes(item.product.id)
    );
    if (!merchantItems.length) continue;

    const totalLineValue = order.items.reduce(
      (sum, item) => sum + numberValue(item.lineTotal),
      0
    );
    const merchantLineValue = merchantItems.reduce(
      (sum, item) => sum + numberValue(item.lineTotal),
      0
    );
    const merchantShare =
      totalLineValue > 0
        ? merchantLineValue / totalLineValue
        : merchantItems.length / Math.max(1, order.items.length);

    if (delivered) {
      deliveredOrders += 1;
      deliveredProductQty += merchantItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
        0
      );

      const settlementVerified =
        order.pathaoPaymentStatus === "PAYMENT_DONE" &&
        Boolean(order.pathaoPaymentVerifiedAt);

      const codRevenue = settlementVerified
        ? Math.max(0, numberValue(order.pathaoSettlementCollectedAmount))
        : 0;

      const fullRevenue = codRevenue + numberValue(order.advance);
      realizedRevenue += fullRevenue * merchantShare;

      for (const item of merchantItems) {
        productCogs += cogsForMerchantItem(item);
      }

      const fullDeliveryCost = settlementVerified
        ? Math.max(0, numberValue(order.pathaoSettlementTotalFee))
        : 0;
      deliveryCost += fullDeliveryCost * merchantShare;
    } else if (returned) {
      returnedOrders += 1;
      const settlementVerified =
        order.pathaoPaymentStatus === "PAYMENT_DONE" &&
        Boolean(order.pathaoPaymentVerifiedAt);
      const verifiedReturnCost = settlementVerified
        ? Math.max(0, numberValue(order.pathaoSettlementTotalFee))
        : 0;
      returnCost += verifiedReturnCost * merchantShare;
    } else {
      pendingOrders += 1;
    }

    const invoiceKey = orderId;
    const totalMerchantLine = merchantItems.reduce(
      (sum, item) => sum + numberValue(item.lineTotal),
      0
    );

    for (const item of merchantItems) {
      const parent = item.product?.parent;
      if (!parent) continue;
      const key = parent.id;
      const line = numberValue(item.lineTotal);
      const lineShare = totalMerchantLine > 0 ? line / totalMerchantLine : 1 / merchantItems.length;
      const existing = parentMap.get(key) || {
        parentId: key,
        sku: parent.sku,
        name: parent.name,
        qty: 0,
        totalInvoices: 0,
        deliveredInvoices: 0,
        returnedInvoices: 0,
        pendingInvoices: 0,
        merchandiseSales: 0,
        cogs: 0,
        courierCost: 0,
        adsCost: 0,
        profit: 0,
        invoiceIds: new Set<string>(),
      };

      existing.qty += Math.max(0, Number(item.quantity || 0));
      if (!existing.invoiceIds.has(invoiceKey)) {
        existing.invoiceIds.add(invoiceKey);
        existing.totalInvoices += 1;
        if (delivered) existing.deliveredInvoices += 1;
        else if (returned) existing.returnedInvoices += 1;
        else existing.pendingInvoices += 1;
      }

      if (delivered) {
        const settlementVerified =
          order.pathaoPaymentStatus === "PAYMENT_DONE" &&
          Boolean(order.pathaoPaymentVerifiedAt);
        const orderRevenue = settlementVerified
          ? Math.max(0, numberValue(order.pathaoSettlementCollectedAmount)) + numberValue(order.advance)
          : numberValue(order.advance);
        existing.merchandiseSales += orderRevenue * merchantShare * lineShare;
        existing.cogs += cogsForMerchantItem(item);
        existing.courierCost +=
          (settlementVerified ? Math.max(0, numberValue(order.pathaoSettlementTotalFee)) : 0) *
          merchantShare *
          lineShare;
      } else if (returned) {
        const settlementVerified =
          order.pathaoPaymentStatus === "PAYMENT_DONE" &&
          Boolean(order.pathaoPaymentVerifiedAt);
        existing.courierCost +=
          (settlementVerified ? Math.max(0, numberValue(order.pathaoSettlementTotalFee)) : 0) *
          merchantShare *
          lineShare;
      }

      parentMap.set(key, existing);
    }
  }

  const dollarByDay = new Map<string, number>();
  for (const row of dollarRates) {
    const usd = numberValue(row.usdAmount);
    const bdt = numberValue(row.bdtAmount);
    dollarByDay.set(
      getBangladeshDateInputValue(row.rateDate),
      usd > 0 ? bdt / usd : 0
    );
  }

  const missingDollarRateDays = new Set<string>();
  const unsupportedAdCurrencies = new Set<string>();
  const adRows: MerchantProfitResult["adRows"] = [];
  let metaAds = 0;
  let metaAdsUsd = 0;

  const campaignPeriodSpend = new Map<string, number>();
  for (const row of adSpends) {
    campaignPeriodSpend.set(
      row.campaign.id,
      (campaignPeriodSpend.get(row.campaign.id) || 0) + numberValue(row.amountSpent)
    );
  }

  for (const row of adSpends) {
    const currency = String(row.currency || "USD").toUpperCase();
    const fullNativeAmount = numberValue(row.amountSpent);
    const mapping = row.campaign.mapping;
    const allocations = mapping?.merchantAllocations || [];
    const totalCampaignSpend = Math.max(0, campaignPeriodSpend.get(row.campaign.id) || 0);
    const partial = allocations.find((item) => item.merchantId === merchantId);
    const totalPartial = allocations.reduce((sum, item) => sum + numberValue(item.amountUsd), 0);
    let merchantShare = 0;
    if (partial && totalCampaignSpend > 0) {
      merchantShare = Math.max(0, Math.min(1, numberValue(partial.amountUsd) / totalCampaignSpend));
    } else if (mapping?.merchantId === merchantId && totalCampaignSpend > 0) {
      merchantShare = Math.max(0, Math.min(1, 1 - totalPartial / totalCampaignSpend));
    }
    const nativeAmount = fullNativeAmount * merchantShare;
    let bdtAmount = 0;

    if (currency === "BDT" || currency === "TK" || currency === "TAKA") {
      bdtAmount = nativeAmount;
    } else if (currency === "USD") {
      const day = getBangladeshDateInputValue(row.spendDate);
      const rate = dollarByDay.get(day) || 0;
      if (!rate && nativeAmount > 0) missingDollarRateDays.add(day);
      bdtAmount = nativeAmount * rate;
    } else if (nativeAmount > 0) {
      unsupportedAdCurrencies.add(currency);
    }

    metaAds += bdtAmount;
    if (currency === "USD") metaAdsUsd += nativeAmount;

    if (mapping?.productParentId && allocatedParentIds.includes(mapping.productParentId)) {
      const parent = parentMap.get(mapping.productParentId);
      if (parent) {
        parent.adsCost += bdtAmount;
        parentMap.set(mapping.productParentId, parent);
      }
    }

    adRows.push({
      id: row.id,
      date: getBangladeshDateInputValue(row.spendDate),
      campaign: row.campaignNameSnapshot,
      currency,
      nativeAmount,
      bdtAmount,
    });
  }

  const wantedMonths = new Set(monthKeys(from, to));
  const operatingCostRows: MerchantProfitResult["operatingCostRows"] = [];
  let operatingCost = 0;

  for (const row of operatingCosts) {
    const month = row.costMonth.toISOString().slice(0, 7);
    if (!wantedMonths.has(month)) continue;

    const fullAmount = numberValue(row.amount);
    const share = monthShare(month, from, to);
    const appliedAmount = fullAmount * share.share;

    operatingCost += appliedAmount;
    operatingCostRows.push({
      month,
      fullAmount,
      appliedAmount,
      daysUsed: share.used,
      daysInMonth: share.days,
    });
  }

  const netProfit =
    realizedRevenue -
    productCogs -
    deliveryCost -
    returnCost -
    metaAds -
    operatingCost;
  const netMargin =
    realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;

  const parentRows = Array.from(parentMap.values())
    .map(({ invoiceIds, ...row }) => ({
      ...row,
      profit: row.merchandiseSales - row.cogs - row.courierCost - row.adsCost,
    }))
    .sort((a, b) => b.merchandiseSales - a.merchandiseSales || a.sku.localeCompare(b.sku));

  return {
    from,
    to,
    deliveredOrders,
    returnedOrders,
    pendingOrders,
    deliveredProductQty,
    realizedRevenue,
    productCogs,
    deliveryCost,
    returnCost,
    metaAds,
    metaAdsUsd,
    operatingCost,
    netProfit,
    netMargin,
    missingDollarRateDays: Array.from(missingDollarRateDays).sort(),
    unsupportedAdCurrencies: Array.from(unsupportedAdCurrencies).sort(),
    operatingCostRows,
    adRows,
    parentRows,
  };
}
