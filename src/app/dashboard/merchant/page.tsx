import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  Package,
  ShoppingBag,
  Truck,
  WalletCards,
} from "lucide-react";

import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { calculateMerchantProfitLoss } from "@/lib/merchant-profit";
import {
  formatTaka,
  formatUsd,
  requireMerchantContext,
  validDate,
} from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function MerchantDashboardPage({ searchParams }: Props) {
  const { merchant } = await requireMerchantContext();
  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || ""))
    ? String(params.from)
    : shiftDate(today, -6);
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const report = await calculateMerchantProfitLoss(merchant.id, from, to);
  const start = bangladeshDateStartUtc(from);
  const end = bangladeshDateEndUtc(to);

  const [parents, recharges, spends, rates, confirmedOrders, omsPurchases] =
    await Promise.all([
      prisma.productParent.findMany({
        where: { merchantId: merchant.id, status: true },
        select: {
          id: true,
          stockMode: true,
          stockQuantity: true,
          stockVerifiedAt: true,
          purchasePrice: true,
          omsOwnedStockQuantity: true,
          products: {
            where: { status: true },
            select: {
              inventoryKind: true,
              quantity: true,
              stockVerifiedAt: true,
              purchasePrice: true,
              omsOwnedStockQuantity: true,
            },
          },
        },
      }),
      prisma.merchantDollarRecharge.findMany({
        where: { merchantId: merchant.id },
        select: { usdAmount: true },
      }),
      prisma.metaDailySpend.findMany({
        where: {
          campaign: {
            mapping: {
              merchantId: merchant.id,
            },
          },
        },
        select: {
          spendDate: true,
          amountSpent: true,
          currency: true,
        },
      }),
      prisma.dailyDollarRate.findMany({
        orderBy: { rateDate: "asc" },
        select: { rateDate: true, usdAmount: true, bdtAmount: true },
      }),
      prisma.order.count({
        where: {
          calledAt: { gte: start, lte: end },
          orderStatus: {
            notIn: [
              "PENDING_CONFIRMATION",
              "NO_ANSWER",
              "PHONE_OFF",
              "DOUBLE_ORDER",
            ],
          },
          items: {
            some: {
              product: {
                parent: { merchantId: merchant.id },
              },
            },
          },
        },
      }),
      prisma.merchantOmsPurchase.findMany({
        where: { merchantId: merchant.id },
        select: { totalCost: true },
      }),
    ]);

  let stockValue = 0;
  let availablePhysicalUnits = 0;

  for (const parent of parents) {
    if (parent.stockMode === "PARENT_STOCK") {
      const available = Math.max(
        0,
        Number(parent.stockQuantity || 0) -
          Number(parent.omsOwnedStockQuantity || 0)
      );
      availablePhysicalUnits += available;
      if (parent.stockVerifiedAt) {
        stockValue += available * Number(parent.purchasePrice || 0);
      }
      continue;
    }

    for (const product of parent.products) {
      if (product.inventoryKind === "BUNDLE") continue;
      const available = Math.max(
        0,
        Number(product.quantity || 0) -
          Number(product.omsOwnedStockQuantity || 0)
      );
      availablePhysicalUnits += available;
      if (product.stockVerifiedAt) {
        stockValue += available * Number(product.purchasePrice || 0);
      }
    }
  }

  const dollarByDay = new Map<string, number>();
  for (const row of rates) {
    const usd = Number(row.usdAmount || 0);
    const bdt = Number(row.bdtAmount || 0);
    dollarByDay.set(
      getBangladeshDateInputValue(row.rateDate),
      usd > 0 ? bdt / usd : 0
    );
  }

  const totalRechargeUsd = recharges.reduce(
    (sum, row) => sum + Number(row.usdAmount || 0),
    0
  );
  const totalBurnUsd = spends.reduce((sum, row) => {
    const amount = Number(row.amountSpent || 0);
    const currency = String(row.currency || "USD").toUpperCase();

    if (currency === "USD") return sum + amount;
    if (currency === "BDT" || currency === "TK" || currency === "TAKA") {
      const rate =
        dollarByDay.get(getBangladeshDateInputValue(row.spendDate)) || 0;
      return sum + (rate > 0 ? amount / rate : 0);
    }

    return sum;
  }, 0);
  const dollarBalance = totalRechargeUsd - totalBurnUsd;

  const omsPurchasedValue = omsPurchases.reduce(
    (sum, row) => sum + Number(row.totalCost || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {merchant.name} Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Daily/date-range Merchant business report, inventory, Pathao,
              Purchase Orders and Meta dollar status.
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="mt-1 block rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </div>

        {dollarBalance < 10 ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Dollar balance warning</p>
              <p className="mt-1 text-sm">
                Current available balance is {formatUsd(dollarBalance)}. Ask
                Admin to recharge the Merchant dollar wallet.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Delivered Revenue"
          value={formatTaka(report.realizedRevenue)}
          icon={CircleDollarSign}
        />
        <Card
          label="Net Profit"
          value={formatTaka(report.netProfit)}
          icon={CircleDollarSign}
          good={report.netProfit >= 0}
          bad={report.netProfit < 0}
        />
        <Card
          label="Confirmed Orders"
          value={confirmedOrders.toLocaleString("en-BD")}
          icon={ShoppingBag}
        />
        <Card
          label="Delivered Orders"
          value={report.deliveredOrders.toLocaleString("en-BD")}
          icon={Truck}
        />
        <Card
          label="Available Physical Stock"
          value={availablePhysicalUnits.toLocaleString("en-BD")}
          icon={Package}
        />
        <Card
          label="Stock Valuation"
          value={formatTaka(stockValue)}
          icon={Package}
        />
        <Card
          label="Dollar Balance"
          value={formatUsd(dollarBalance)}
          icon={WalletCards}
          good={dollarBalance >= 10}
          bad={dollarBalance < 10}
        />
        <Card
          label="OMS Purchased Value"
          value={formatTaka(omsPurchasedValue)}
          icon={Package}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Mini
          label="Product COGS"
          value={formatTaka(report.productCogs)}
        />
        <Mini
          label="Pathao Delivery Cost"
          value={formatTaka(report.deliveryCost)}
        />
        <Mini label="Pathao Return Cost" value={formatTaka(report.returnCost)} />
        <Mini label="Meta Ads" value={formatTaka(report.metaAds)} />
        <Mini
          label="Operating Cost"
          value={formatTaka(report.operatingCost)}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QuickLink
          href="/dashboard/merchant/products"
          title="Products & Stock"
          description="See assigned Parent Codes, available qty and stock valuation."
          icon={Package}
        />
        <QuickLink
          href="/dashboard/merchant/orders"
          title="Merchant Orders"
          description="See Calling Agent confirmed invoices and your product lines."
          icon={ShoppingBag}
        />
        <QuickLink
          href="/dashboard/merchant/pathao-report"
          title="Pathao Delivery Report"
          description="Verified webhook delivery, return and courier costs."
          icon={Truck}
        />
        <QuickLink
          href="/dashboard/merchant/profit-loss"
          title="Profit & Loss"
          description="Detailed date-range Merchant profit and loss."
          icon={CircleDollarSign}
        />
        <QuickLink
          href="/dashboard/merchant/dollar-wallet"
          title="Dollar Wallet"
          description="Recharge history, Facebook burning and live balance."
          icon={WalletCards}
        />
        <QuickLink
          href="/dashboard/merchant/purchases"
          title="Purchase & Received"
          description="Purchase Orders selected for your Merchant and received stock."
          icon={Package}
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
        <p>
          Current report period: <strong>{from}</strong> to{" "}
          <strong>{to}</strong>. Net Profit uses the same Merchant P&L engine
          shown on the Profit & Loss page.
        </p>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  icon: Icon,
  good,
  bad,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  good?: boolean;
  bad?: boolean;
}) {
  const valueClass = good
    ? "text-emerald-700"
    : bad
      ? "text-rose-700"
      : "text-slate-950";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className={"mt-3 text-2xl font-extrabold " + valueClass}>{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Package;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-700" />
        <h2 className="font-bold text-slate-950">{title}</h2>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
    </Link>
  );
}
