export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  Banknote,
  Megaphone,
  PackageCheck,
  ReceiptText,
  Truck,
  Users,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { calculateSalaryTotals } from "@/lib/finance/salary";

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    sourceId?: string;
    courierId?: string;
  }>;
};

type CostCategory = { category: string; amount: number; entries: number };
type OperationRow = {
  id: string;
  name: string;
  delivered: number;
  returned: number;
  revenue: number;
  cogs: number;
  deliveryCost: number;
  returnCost: number;
};
type ProductRow = {
  key: string;
  name: string;
  quantity: number;
  sales: number;
  cogs: number;
};
type AdsRow = {
  key: string;
  campaign: string;
  account: string;
  periodAmount: number;
  appliedAmount: number;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function taka(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberValue(value: unknown) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function rawNumber(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    const parsed = Number(
      typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value
    );
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function eventName(value: string) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-");
}

function displayEvent(value: string) {
  return value
    .replace(/^order\./, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function dateEpoch(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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

function costIncluded(category: string) {
  const key = String(category || "").trim().toLowerCase();
  return ![
    "salary",
    "salary advance",
    "product purchase",
    "product purchases",
    "product purches",
  ].includes(key);
}

export default async function ProfitMarginPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const sourceId = String(params.sourceId || "").trim();
  const courierId = String(params.courierId || "").trim();
  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);
  const { prisma } = await import("@/lib/prisma");

  const [sources, couriers, webhooks, financeRows, dollarRates, adsRowsRaw, salaryProfiles] =
    await Promise.all([
      prisma.orderSource.findMany({
        where: { status: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.courier.findMany({
        where: { status: true, pathaoEnabled: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.pathaoWebhookEvent.findMany({
        where: {
          signatureValid: true,
          processed: true,
          orderId: { not: null },
          receivedAt: { gte: start, lte: end },
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
      prisma.financeDailyCost.findMany({
        where: { costDate: { gte: start, lte: end } },
        orderBy: [{ costDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          bookType: true,
          entryType: true,
          category: true,
          amount: true,
        },
      }),
      prisma.dailyDollarRate.findMany({
        where: { rateDate: { gte: start, lte: end } },
        orderBy: { rateDate: "asc" },
        select: { rateDate: true, usdAmount: true, bdtAmount: true },
      }),
      prisma.metaDailySpend.findMany({
        where: { spendDate: { gte: start, lte: end } },
        orderBy: [{ spendDate: "asc" }, { campaignNameSnapshot: "asc" }],
        select: {
          id: true,
          spendDate: true,
          amountSpent: true,
          currency: true,
          campaignNameSnapshot: true,
          adAccount: { select: { id: true, name: true } },
          campaign: {
            select: {
              id: true,
              mapping: {
                select: {
                  productParentId: true,
                  sources: { select: { sourceId: true } },
                },
              },
            },
          },
        },
      }),
      prisma.salaryProfile.findMany({
        include: {
          user: { select: { id: true, name: true, username: true } },
          salaryMonths: { include: { transactions: true } },
        },
        orderBy: { user: { name: "asc" } },
      }),
    ]);

  const orderIds = Array.from(
    new Set(webhooks.map((row) => row.orderId).filter((id): id is string => Boolean(id)))
  );

  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          sourceId: true,
          pathaoCourierId: true,
          totalAmount: true,
          advance: true,
          deliveryCharge: true,
          pathaoDeliveryFee: true,
          pathaoAmountToCollect: true,
          pathaoAuthorizedCodAmount: true,
          source: { select: { id: true, name: true, type: true } },
          pathaoCourier: { select: { id: true, name: true } },
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
                      stockMode: true,
                      purchasePrice: true,
                    },
                  },
                  bundleComponents: {
                    select: {
                      units: true,
                      componentProduct: { select: { purchasePrice: true } },
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
    const list = eventMap.get(webhook.orderId) || [];
    list.push(webhook);
    eventMap.set(webhook.orderId, list);
  }

  type Evaluated = {
    order: (typeof orders)[number];
    delivered: boolean;
    returned: boolean;
    partial: boolean;
    latest: string;
    revenue: number;
    codRevenue: number;
    advanceRevenue: number;
    billed: number;
    deliveryIncome: number;
    cogs: number;
    deliveryCost: number;
    returnCost: number;
    missingCost: number;
    missingReturnFee: boolean;
  };

  function cogsForItem(item: (typeof orders)[number]["items"][number]) {
    const product = item.product;
    const qty = Math.max(0, Number(item.quantity || 0));
    if (!product) return { amount: 0, missing: true };

    if (product.inventoryKind === "BUNDLE") {
      const setCost = product.bundleComponents.reduce(
        (sum, part) => sum + numberValue(part.componentProduct.purchasePrice) * part.units,
        0
      );
      return { amount: setCost * qty, missing: setCost <= 0 };
    }

    if (product.parent.stockMode === "PARENT_STOCK") {
      const price = numberValue(product.parent.purchasePrice);
      return {
        amount: price * Math.max(1, Number(product.unitsPerSale || 1)) * qty,
        missing: price <= 0,
      };
    }

    const price = numberValue(product.purchasePrice);
    return { amount: price * qty, missing: price <= 0 };
  }

  const evaluated: Evaluated[] = [];
  for (const [id, events] of eventMap) {
    const order = orderMap.get(id);
    if (!order) continue;

    let deliveredAt = -1;
    let returnedAt = -1;
    let partialAt = -1;
    let deliveredPayload: unknown = null;
    let returnCost = 0;
    let paidReturn = false;
    let latest = "unknown";
    let latestAt = -1;

    for (const webhook of events) {
      const name = eventName(webhook.eventName);
      const time = webhook.receivedAt.getTime();
      if (time >= latestAt) {
        latestAt = time;
        latest = name;
      }
      if (name === "order.delivered" || name === "delivered") {
        deliveredAt = time;
        deliveredPayload = webhook.rawPayload;
      }
      if (name === "order.partial-delivery" || name === "partial-delivery") {
        partialAt = time;
      }
      if (
        name === "order.returned" ||
        name === "order.return" ||
        name === "order.return-id-created" ||
        name === "order.return-in-transit" ||
        name === "order.returned-to-merchant" ||
        name === "order.paid-return" ||
        name === "returned" ||
        name === "return"
      ) {
        returnedAt = Math.max(returnedAt, time);
      }
      if (name === "order.paid-return" || name === "paid-return") {
        paidReturn = true;
        const fee = rawNumber(webhook.rawPayload, [
          "collected_amount",
          "return_charge",
          "return_fee",
        ]);
        if (fee !== null) returnCost = Math.max(0, fee);
      }
    }

    const returned = returnedAt >= 0 && returnedAt >= deliveredAt;
    const delivered = deliveredAt >= 0 && deliveredAt > returnedAt;
    const partial = !delivered && !returned && partialAt >= 0;

    const collected = delivered
      ? rawNumber(deliveredPayload, [
          "collected_amount",
          "amount_collected",
          "amount_to_collect",
          "cod_amount",
        ])
      : null;

    const codDue = numberValue(order.totalAmount);
    const advanceRevenue = delivered ? numberValue(order.advance) : 0;
    const codRevenue = delivered
      ? collected !== null
        ? Math.max(0, collected)
        : numberValue(order.pathaoAmountToCollect) ||
          numberValue(order.pathaoAuthorizedCodAmount) ||
          codDue
      : 0;
    // OMS totalAmount/COD is net of advance. The advance was already received,
    // so realized order revenue must add it back exactly once.
    const revenue = delivered ? codRevenue + advanceRevenue : 0;
    const billed = delivered ? codDue + advanceRevenue : 0;

    let cogs = 0;
    let missingCost = 0;
    if (delivered) {
      for (const item of order.items) {
        const result = cogsForItem(item);
        cogs += result.amount;
        if (result.missing) missingCost += 1;
      }
    }

    const webhookDeliveryFee = delivered
      ? rawNumber(deliveredPayload, ["delivery_fee"])
      : null;
    const deliveryCost = delivered
      ? Math.max(
          0,
          webhookDeliveryFee !== null
            ? webhookDeliveryFee
            : numberValue(order.pathaoDeliveryFee)
        )
      : 0;

    evaluated.push({
      order,
      delivered,
      returned,
      partial,
      latest,
      revenue,
      codRevenue,
      advanceRevenue,
      billed,
      deliveryIncome: delivered ? numberValue(order.deliveryCharge) : 0,
      cogs,
      deliveryCost,
      returnCost,
      missingCost,
      missingReturnFee: returned && (!paidReturn || returnCost <= 0),
    });
  }

  const selected = evaluated.filter(
    (row) =>
      (!sourceId || row.order.sourceId === sourceId) &&
      (!courierId || row.order.pathaoCourierId === courierId)
  );
  const delivered = selected.filter((row) => row.delivered);
  const returned = selected.filter((row) => row.returned);
  const partialCount = selected.filter((row) => row.partial).length;
  const allRevenue = evaluated
    .filter((row) => row.delivered)
    .reduce((sum, row) => sum + row.revenue, 0);

  const grossRevenue = delivered.reduce((sum, row) => sum + row.revenue, 0);
  const codRevenue = delivered.reduce((sum, row) => sum + row.codRevenue, 0);
  const advanceRevenue = delivered.reduce((sum, row) => sum + row.advanceRevenue, 0);
  const billedRevenue = delivered.reduce((sum, row) => sum + row.billed, 0);
  const customerDeliveryIncome = delivered.reduce(
    (sum, row) => sum + row.deliveryIncome,
    0
  );
  const merchandiseRevenue = Math.max(0, grossRevenue - customerDeliveryIncome);
  const productCogs = delivered.reduce((sum, row) => sum + row.cogs, 0);
  const deliveryCost = delivered.reduce((sum, row) => sum + row.deliveryCost, 0);
  const returnCost = returned.reduce((sum, row) => sum + row.returnCost, 0);
  const missingCostLines = delivered.reduce((sum, row) => sum + row.missingCost, 0);
  const missingReturnFees = returned.filter((row) => row.missingReturnFee).length;

  const filteredView = Boolean(sourceId || courierId);
  const allocationShare = filteredView && allRevenue > 0
    ? Math.max(0, Math.min(1, grossRevenue / allRevenue))
    : filteredView
      ? 0
      : 1;

  const salaryMonths: Array<{ month: string; amount: number; used: number; days: number }> = [];
  let salaryTotal = 0;
  for (const month of monthKeys(from, to)) {
    const share = monthShare(month, from, to);
    let monthly = 0;

    for (const profile of salaryProfiles) {
      const snapshot = profile.salaryMonths.find(
        (row) => getBangladeshDateInputValue(row.monthDate).slice(0, 7) === month
      );
      const profileCreatedMonth = getBangladeshDateInputValue(profile.createdAt).slice(0, 7);
      if (!snapshot && month < profileCreatedMonth) continue;
      if (!snapshot && !profile.enabled) continue;

      const totals = snapshot
        ? calculateSalaryTotals({
            baseSalary: snapshot.baseSalary,
            incrementAmount: snapshot.incrementAmount,
            transactions: snapshot.transactions,
          })
        : calculateSalaryTotals({
            baseSalary: profile.baseSalary,
            incrementAmount: profile.incrementAmount,
            transactions: [],
          });

      monthly += (totals.salaryDue + totals.liability) * share.share;
    }

    salaryMonths.push({ month, amount: monthly, used: share.used, days: share.days });
    salaryTotal += monthly;
  }

  function summarizeCost(bookType: "GENERAL" | "OFFICE") {
    const rows = financeRows.filter(
      (row) => row.bookType === bookType && row.entryType === "KHOROCH"
    );
    const map = new Map<string, CostCategory>();
    let raw = 0;
    let included = 0;
    let excluded = 0;

    for (const row of rows) {
      const amount = numberValue(row.amount);
      raw += amount;
      if (costIncluded(row.category)) included += amount;
      else excluded += amount;

      const current = map.get(row.category) || {
        category: row.category,
        amount: 0,
        entries: 0,
      };
      current.amount += amount;
      current.entries += 1;
      map.set(row.category, current);
    }

    return {
      raw,
      included,
      excluded,
      categories: Array.from(map.values()).sort((a, b) => b.amount - a.amount),
    };
  }

  const daily = summarizeCost("GENERAL");
  const office = summarizeCost("OFFICE");

  const dollarByDay = new Map<string, { usd: number; bdt: number }>();
  for (const row of dollarRates) {
    const key = getBangladeshDateInputValue(row.rateDate);
    const current = dollarByDay.get(key) || { usd: 0, bdt: 0 };
    current.usd += numberValue(row.usdAmount);
    current.bdt += numberValue(row.bdtAmount);
    dollarByDay.set(key, current);
  }

  // Source attribution for ads follows the saved Meta campaign mapping.
  // When one campaign maps to multiple Sources, use delivered order share for
  // that mapped parent product in the selected webhook period.
  const parentSourceDeliveredCounts = new Map<string, number>();
  for (const row of evaluated) {
    if (!row.delivered) continue;
    const parentIds = new Set(
      row.order.items
        .map((item) => item.product?.parent.id)
        .filter((id): id is string => Boolean(id))
    );
    for (const parentId of parentIds) {
      const key = parentId + "::" + row.order.sourceId;
      parentSourceDeliveredCounts.set(
        key,
        (parentSourceDeliveredCounts.get(key) || 0) + 1
      );
    }
  }

  const missingRateDays = new Set<string>();
  const unsupportedAdCurrencies = new Set<string>();
  const adMap = new Map<string, AdsRow>();
  let adsTotal = 0;
  let adsSourceAttributed = 0;
  let unmappedAdsForSource = 0;

  for (const row of adsRowsRaw) {
    const currency = String(row.currency || "USD").toUpperCase();
    const amount = numberValue(row.amountSpent);
    let bdt = 0;

    if (currency === "BDT" || currency === "TK" || currency === "TAKA") {
      bdt = amount;
    } else if (currency === "USD") {
      const day = getBangladeshDateInputValue(row.spendDate);
      const rateRow = dollarByDay.get(day);
      const rate = rateRow && rateRow.usd > 0 ? rateRow.bdt / rateRow.usd : 0;
      if (!rate && amount > 0) missingRateDays.add(day);
      bdt = amount * rate;
    } else if (amount > 0) {
      unsupportedAdCurrencies.add(currency);
    }

    adsTotal += bdt;
    let sourceAmount = bdt;
    const mapping = row.campaign.mapping;

    if (sourceId) {
      if (!mapping) {
        sourceAmount = 0;
        unmappedAdsForSource += bdt;
      } else {
        const mappedSourceIds = mapping.sources.map((item) => item.sourceId);
        if (!mappedSourceIds.includes(sourceId)) {
          sourceAmount = 0;
        } else if (mappedSourceIds.length > 1) {
          const counts = mappedSourceIds.map(
            (mappedSourceId) =>
              parentSourceDeliveredCounts.get(
                mapping.productParentId + "::" + mappedSourceId
              ) || 0
          );
          const totalCount = counts.reduce((sum, count) => sum + count, 0);
          const selectedIndex = mappedSourceIds.indexOf(sourceId);
          const sourceShare =
            totalCount > 0
              ? counts[selectedIndex] / totalCount
              : 1 / mappedSourceIds.length;
          sourceAmount = bdt * sourceShare;
        }
      }
    }

    adsSourceAttributed += sourceAmount;

    const key = row.campaign.id + "::" + row.adAccount.id;
    const current = adMap.get(key) || {
      key,
      campaign: row.campaignNameSnapshot,
      account: row.adAccount.name,
      periodAmount: 0,
      appliedAmount: 0,
    };
    current.periodAmount += bdt;
    current.appliedAmount += sourceAmount;
    adMap.set(key, current);
  }

  // Campaigns do not have a courier dimension. Only the courier slice of the
  // already source-attributed ad cost is applied when a Courier is selected.
  let courierAdsShare = 1;
  if (courierId) {
    const denominator = evaluated
      .filter(
        (row) =>
          row.delivered &&
          (!sourceId || row.order.sourceId === sourceId)
      )
      .reduce((sum, row) => sum + row.revenue, 0);
    courierAdsShare =
      denominator > 0
        ? Math.max(0, Math.min(1, grossRevenue / denominator))
        : 0;
  }

  const salaryApplied = salaryTotal * allocationShare;
  const dailyApplied = daily.included * allocationShare;
  const officeApplied = office.included * allocationShare;
  const adsApplied = adsSourceAttributed * courierAdsShare;
  const courierCost = deliveryCost + returnCost;
  const netProfit =
    grossRevenue -
    productCogs -
    courierCost -
    adsApplied -
    salaryApplied -
    dailyApplied -
    officeApplied;
  const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  const productMap = new Map<string, ProductRow>();
  for (const row of delivered) {
    for (const item of row.order.items) {
      const key = item.product?.parent.sku || item.productSku;
      const name = item.product?.parent.name || item.productName;
      const current = productMap.get(key) || {
        key,
        name,
        quantity: 0,
        sales: 0,
        cogs: 0,
      };
      current.quantity += Math.max(0, Number(item.quantity || 0));
      current.sales += numberValue(item.lineTotal);
      current.cogs += cogsForItem(item).amount;
      productMap.set(key, current);
    }
  }
  const productRows = Array.from(productMap.values()).sort(
    (a, b) => b.sales - a.sales
  );

  function operationRows(kind: "source" | "courier") {
    const map = new Map<string, OperationRow>();
    for (const row of selected) {
      const id = kind === "source"
        ? row.order.source.id
        : row.order.pathaoCourier?.id || "NO_COURIER";
      const name = kind === "source"
        ? row.order.source.name
        : row.order.pathaoCourier?.name || "No Pathao courier";
      const current = map.get(id) || {
        id,
        name,
        delivered: 0,
        returned: 0,
        revenue: 0,
        cogs: 0,
        deliveryCost: 0,
        returnCost: 0,
      };
      if (row.delivered) {
        current.delivered += 1;
        current.revenue += row.revenue;
        current.cogs += row.cogs;
        current.deliveryCost += row.deliveryCost;
      }
      if (row.returned) {
        current.returned += 1;
        current.returnCost += row.returnCost;
      }
      map.set(id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }

  const sourceRows = operationRows("source");
  const courierRows = operationRows("courier");
  const adsRows = Array.from(adMap.values())
    .map((row) => ({
      ...row,
      appliedAmount: row.appliedAmount * courierAdsShare,
    }))
    .sort((a, b) => b.appliedAmount - a.appliedAmount);

  const warnings: string[] = [];
  if (missingCostLines) {
    warnings.push(
      String(missingCostLines) +
        " delivered product line(s) have no usable purchase cost; profit is overstated until Product Master cost is updated."
    );
  }
  if (missingReturnFees) {
    warnings.push(
      String(missingReturnFees) +
        " returned order(s) have no Paid Return collected_amount in this period; return charge is understated."
    );
  }
  if (missingRateDays.size) {
    warnings.push(
      "Missing USD rate for " +
        Array.from(missingRateDays).sort().join(", ") +
        "; affected Meta spend is BDT 0 until the dollar rate is entered."
    );
  }
  if (unsupportedAdCurrencies.size) {
    warnings.push(
      "Unsupported Meta ad currency: " +
        Array.from(unsupportedAdCurrencies).sort().join(", ") +
        ". Add a conversion rule before relying on those campaign costs."
    );
  }
  if (partialCount) {
    warnings.push(
      String(partialCount) +
        " Partial Delivery order(s) are excluded from realized revenue/COGS because OMS does not know the exact accepted items."
    );
  }
  if (filteredView) {
    warnings.push(
      "Salary, Daily Costing and Office Daily Costing are shared overhead. This filtered view applies " +
        (allocationShare * 100).toFixed(2) +
        "% of those costs using the selected slice's share of company delivered revenue."
    );
  }
  if (sourceId) {
    warnings.push(
      "Meta ads follow the saved campaign-to-Source mapping. Multi-Source campaigns are split by delivered order count for the mapped parent product in this date range."
    );
    if (unmappedAdsForSource > 0) {
      warnings.push(
        taka(unmappedAdsForSource) +
          " of Meta spend has no campaign Source mapping and is excluded from this Source-filtered view."
      );
    }
  }
  if (courierId) {
    warnings.push(
      "Meta campaigns have no courier field. " +
        (courierAdsShare * 100).toFixed(2) +
        "% of the Source-attributed ad spend is applied to this courier using delivered-revenue share."
    );
  }
  const excludedDuplicates = daily.excluded + office.excluded;
  if (excludedDuplicates) {
    warnings.push(
      taka(excludedDuplicates) +
        " of Salary/Salary Advance/Product Purchase cash-book entries is shown but not deducted again, preventing double counting against Salary and Product COGS."
    );
  }

  const filteredStatusCounts = new Map<string, number>();
  for (const row of selected) {
    filteredStatusCounts.set(row.latest, (filteredStatusCounts.get(row.latest) || 0) + 1);
  }
  const topStatuses = Array.from(filteredStatusCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const selectedSource = sources.find((row) => row.id === sourceId)?.name || "All Sources";
  const selectedCourier = couriers.find((row) => row.id === courierId)?.name || "All Pathao Couriers";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Profit Margin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Realized business profit/loss using verified Pathao webhook outcomes,
            Product Master buying cost, Meta ads, salary and daily operating costs.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm">
            <span className="font-medium">From</span>
            <input name="from" type="date" defaultValue={from} className="w-full rounded-xl border px-3 py-2.5" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">To</span>
            <input name="to" type="date" defaultValue={to} className="w-full rounded-xl border px-3 py-2.5" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Source</span>
            <select name="sourceId" defaultValue={sourceId} className="w-full rounded-xl border px-3 py-2.5">
              <option value="">All Sources</option>
              {sources.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.type})</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Courier</span>
            <select name="courierId" defaultValue={courierId} className="w-full rounded-xl border px-3 py-2.5">
              <option value="">All Pathao Couriers</option>
              {couriers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <button className="self-end rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Apply Filters
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Profit period: {from} to {to} · {selectedSource} · {selectedCourier}.
          Sales/returns are recognized by Pathao webhook received date.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Realized Revenue" value={taka(grossRevenue)} note={String(delivered.length) + " delivered order(s)"} tone="emerald" />
        <SummaryCard title="Product COGS" value={taka(productCogs)} note="Buying cost of delivered items" tone="rose" />
        <SummaryCard title="Total Operating Cost" value={taka(courierCost + adsApplied + salaryApplied + dailyApplied + officeApplied)} note="Courier + Ads + Salary + Costing" tone="amber" />
        <SummaryCard title="Net Profit / Loss" value={taka(netProfit)} note={"Net margin " + netMargin.toFixed(2) + "%"} tone={netProfit >= 0 ? "emerald" : "rose"} />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-lg font-bold">100% Profit / Loss Calculation</h2>
            <p className="text-sm text-slate-500">Every deducted component used in the final number.</p>
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
          <CalcLine label="Pathao COD collected / due" value={codRevenue} positive />
          <CalcLine label="Customer advance already received" value={advanceRevenue} positive />
          <CalcLine label="Total realized revenue" value={grossRevenue} positive />
          <CalcLine label="OMS full order value incl. advance (reference)" value={billedRevenue} muted />
          <CalcLine label="Merchandise revenue inside collected amount" value={merchandiseRevenue} muted />
          <CalcLine label="Customer delivery charge inside revenue" value={customerDeliveryIncome} muted />
          <CalcLine label="Product buying cost / COGS" value={-productCogs} />
          <CalcLine label="Pathao delivery fee" value={-deliveryCost} />
          <CalcLine label="Pathao Paid Return charge" value={-returnCost} />
          <CalcLine label="Meta Ads cost applied" value={-adsApplied} />
          <CalcLine label="Salary cost applied" value={-salaryApplied} />
          <CalcLine label="Daily Costing applied" value={-dailyApplied} />
          <CalcLine label="Office Daily Costing applied" value={-officeApplied} />
          <div className="border-t pt-3 lg:col-span-2">
            <div className="flex items-center justify-between gap-4 text-lg font-bold">
              <span>NET PROFIT / LOSS</span>
              <span className={netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}>{taka(netProfit)}</span>
            </div>
          </div>
        </div>
      </section>

      {warnings.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="h-5 w-5" /> Data / Accounting Notes
          </div>
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <DetailCard
          icon={<Users className="h-5 w-5" />}
          title={"Salary · " + from + " → " + to}
          total={salaryApplied}
          periodTotal={salaryTotal}
          allocationShare={allocationShare}
          rows={salaryMonths.map((row) => ({
            label: row.month + " (" + row.used + "/" + row.days + " days)",
            value: row.amount,
          }))}
        />
        <DetailCard
          icon={<ReceiptText className="h-5 w-5" />}
          title="Daily Costing"
          total={dailyApplied}
          periodTotal={daily.included}
          allocationShare={allocationShare}
          rows={daily.categories.filter((row) => costIncluded(row.category)).slice(0, 6).map((row) => ({ label: row.category, value: row.amount }))}
          footnote={"Raw khoroch " + taka(daily.raw) + " · P&L included " + taka(daily.included) + " · Duplicate-protected/excluded " + taka(daily.excluded)}
        />
        <DetailCard
          icon={<Banknote className="h-5 w-5" />}
          title="Office Daily Costing"
          total={officeApplied}
          periodTotal={office.included}
          allocationShare={allocationShare}
          rows={office.categories.filter((row) => costIncluded(row.category)).slice(0, 6).map((row) => ({ label: row.category, value: row.amount }))}
          footnote={"Raw khoroch " + taka(office.raw) + " · P&L included " + taka(office.included) + " · Duplicate-protected/excluded " + taka(office.excluded)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            <h2 className="text-lg font-bold">Ads Cost · Date Range</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Period Meta Spend" value={taka(adsTotal)} />
            <MiniStat label="Applied to Current View" value={taka(adsApplied)} />
          </div>
          <div className="mt-4 divide-y rounded-2xl border">
            {adsRows.slice(0, 8).map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{row.campaign}</p>
                  <p className="truncate text-xs text-slate-500">{row.account}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{taka(row.appliedAmount)}</p>
                  {row.appliedAmount !== row.periodAmount ? (
                    <p className="text-[11px] text-slate-400">
                      Period {taka(row.periodAmount)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
            {!adsRows.length ? <p className="px-4 py-6 text-center text-sm text-slate-500">No Meta spend in this date range.</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            <h2 className="text-lg font-bold">Pathao Courier Cost</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Delivered Orders" value={String(delivered.length)} />
            <MiniStat label="Returned Orders" value={String(returned.length)} />
            <MiniStat label="Delivery Fees" value={taka(deliveryCost)} />
            <MiniStat label="Paid Return Fees" value={taka(returnCost)} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Delivery fee uses the delivered webhook fee when present, otherwise the saved Pathao fee.
            Return fee uses Paid Return webhook collected_amount.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5" />
          <h2 className="text-lg font-bold">Product Gross Margin</h2>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border">
          <table className="min-w-[850px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Parent Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Merchandise Sales</th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Gross Profit</th>
                <th className="px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => {
                const profit = row.sales - row.cogs;
                const margin = row.sales > 0 ? (profit / row.sales) * 100 : 0;
                return (
                  <tr key={row.key} className="border-t">
                    <td className="px-4 py-3"><p className="font-semibold">{row.key}</p><p className="text-xs text-slate-500">{row.name}</p></td>
                    <td className="px-4 py-3 text-right">{row.quantity}</td>
                    <td className="px-4 py-3 text-right">{taka(row.sales)}</td>
                    <td className="px-4 py-3 text-right">{taka(row.cogs)}</td>
                    <td className={"px-4 py-3 text-right font-semibold " + (profit >= 0 ? "text-emerald-700" : "text-rose-700")}>{taka(profit)}</td>
                    <td className="px-4 py-3 text-right">{margin.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {!productRows.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No delivered products in the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <OperationTable title="Source-wise Delivery Economics" rows={sourceRows} />
        <OperationTable title="Courier-wise Delivery Economics" rows={courierRows} />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Pathao Webhook Activity</h2>
        <p className="mt-1 text-sm text-slate-500">
          Latest verified event received for each parcel touched in this date range.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topStatuses.map((row) => (
            <div key={row.name} className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">{displayEvent(row.name)}</p>
              <p className="mt-2 text-2xl font-bold">{row.count}</p>
            </div>
          ))}
          {!topStatuses.length ? <p className="text-sm text-slate-500">No verified Pathao webhook activity in this date range.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <strong>Accounting basis:</strong> revenue is recognized only from full Delivered webhooks.
        Realized revenue equals Pathao COD/collected amount plus any customer advance already received.
        Partial Delivery is excluded until OMS can identify accepted items. Product Purchase cash-book
        entries are not deducted again because delivered product COGS already uses Product Master buying cost.
        Salary and Salary Advance cash-book categories are also excluded to prevent double counting the Salary module.
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: "emerald" | "rose" | "amber";
}) {
  const toneClass = tone === "emerald"
    ? "border-emerald-100 bg-emerald-50 text-emerald-900"
    : tone === "rose"
      ? "border-rose-100 bg-rose-50 text-rose-900"
      : "border-amber-100 bg-amber-50 text-amber-900";
  return (
    <div className={"rounded-3xl border p-5 shadow-sm " + toneClass}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs opacity-70">{note}</p>
    </div>
  );
}

function CalcLine({
  label,
  value,
  positive,
  muted,
}: {
  label: string;
  value: number;
  positive?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={"flex items-center justify-between gap-4 text-sm " + (muted ? "text-slate-400" : "text-slate-700")}>
      <span>{label}</span>
      <span className={"font-semibold " + (positive ? "text-emerald-700" : value < 0 ? "text-rose-700" : "")}>
        {value < 0 ? "- " + taka(Math.abs(value)) : taka(value)}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function DetailCard({
  icon,
  title,
  total,
  periodTotal,
  allocationShare,
  rows,
  footnote,
}: {
  icon: ReactNode;
  title: string;
  total: number;
  periodTotal: number;
  allocationShare: number;
  rows: Array<{ label: string; value: number }>;
  footnote?: string;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">{icon}<h2 className="font-bold">{title}</h2></div>
      <p className="mt-3 text-2xl font-bold">{taka(total)}</p>
      {allocationShare < 0.9999 ? (
        <p className="mt-1 text-xs text-slate-500">
          Applied {(allocationShare * 100).toFixed(2)}% of period total {taka(periodTotal)}
        </p>
      ) : null}
      <div className="mt-4 divide-y rounded-2xl border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="truncate text-slate-600">{row.label}</span>
            <span className="shrink-0 font-semibold">{taka(row.value * allocationShare)}</span>
          </div>
        ))}
        {!rows.length ? <p className="px-3 py-5 text-center text-sm text-slate-500">No cost records.</p> : null}
      </div>
      {footnote ? <p className="mt-3 text-xs text-slate-500">{footnote}</p> : null}
    </div>
  );
}

function OperationTable({ title, rows }: { title: string; rows: OperationRow[] }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3 text-right">Delivered</th>
              <th className="px-3 py-3 text-right">Return</th>
              <th className="px-3 py-3 text-right">Revenue</th>
              <th className="px-3 py-3 text-right">COGS</th>
              <th className="px-3 py-3 text-right">Courier Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-3 font-semibold">{row.name}</td>
                <td className="px-3 py-3 text-right">{row.delivered}</td>
                <td className="px-3 py-3 text-right">{row.returned}</td>
                <td className="px-3 py-3 text-right">{taka(row.revenue)}</td>
                <td className="px-3 py-3 text-right">{taka(row.cogs)}</td>
                <td className="px-3 py-3 text-right">{taka(row.deliveryCost + row.returnCost)}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="px-3 py-7 text-center text-slate-500">No rows for this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
