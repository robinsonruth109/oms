import "server-only";

import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { prisma } from "@/lib/prisma";
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
};

export async function calculateMerchantProfitLoss(
  merchantId: string,
  from: string,
  to: string
): Promise<MerchantProfitResult> {
  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);

  const [webhooks, dollarRates, adSpends, operatingCosts] = await Promise.all([
    prisma.pathaoWebhookEvent.findMany({
      where: {
        signatureValid: true,
        processed: true,
        orderId: { not: null },
        receivedAt: { gte: start, lte: end },
        order: {
          items: {
            some: {
              product: {
                parent: { merchantId },
              },
            },
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
            merchantId,
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
          items: {
            select: {
              id: true,
              quantity: true,
              lineTotal: true,
              product: {
                select: {
                  id: true,
                  inventoryKind: true,
                  purchasePrice: true,
                  unitsPerSale: true,
                  parent: {
                    select: {
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
      (item) => item.product?.parent.merchantId === merchantId
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

      const collected = rawNumber(deliveredPayload, [
        "collected_amount",
        "amount_collected",
        "amount_to_collect",
        "cod_amount",
      ]);

      const codRevenue =
        collected !== null
          ? Math.max(0, collected)
          : numberValue(order.pathaoAmountToCollect) ||
            numberValue(order.pathaoAuthorizedCodAmount) ||
            numberValue(order.totalAmount);

      const fullRevenue = codRevenue + numberValue(order.advance);
      realizedRevenue += fullRevenue * merchantShare;

      for (const item of merchantItems) {
        productCogs += cogsForMerchantItem(item);
      }

      const webhookDeliveryFee = rawNumber(deliveredPayload, ["delivery_fee"]);
      const fullDeliveryCost = Math.max(
        0,
        webhookDeliveryFee !== null
          ? webhookDeliveryFee
          : numberValue(order.pathaoDeliveryFee)
      );
      deliveryCost += fullDeliveryCost * merchantShare;
    } else if (returned) {
      returnedOrders += 1;
      returnCost += paidReturnCost * merchantShare;
    } else {
      pendingOrders += 1;
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

  for (const row of adSpends) {
    const currency = String(row.currency || "USD").toUpperCase();
    const nativeAmount = numberValue(row.amountSpent);
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
    operatingCost,
    netProfit,
    netMargin,
    missingDollarRateDays: Array.from(missingDollarRateDays).sort(),
    unsupportedAdCurrencies: Array.from(unsupportedAdCurrencies).sort(),
    operatingCostRows,
    adRows,
  };
}
