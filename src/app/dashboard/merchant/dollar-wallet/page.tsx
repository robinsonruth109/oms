import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";

import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import {
  formatTaka,
  formatUsd,
  requireMerchantContext,
} from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantDollarWalletPage() {
  const { merchant } = await requireMerchantContext();
  const { prisma } = await import("@/lib/prisma");

  const [recharges, spends, rates, shopSetting] = await Promise.all([
    prisma.merchantDollarRecharge.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ rechargeDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.metaDailySpend.findMany({
      where: {
        campaign: {
          mapping: {
            merchantId: merchant.id,
          },
        },
      },
      orderBy: [{ spendDate: "desc" }, { campaignNameSnapshot: "asc" }],
      select: {
        id: true,
        spendDate: true,
        amountSpent: true,
        currency: true,
        campaignNameSnapshot: true,
        adAccount: { select: { name: true } },
      },
    }),
    prisma.dailyDollarRate.findMany({
      orderBy: { rateDate: "asc" },
      select: { rateDate: true, usdAmount: true, bdtAmount: true },
    }),
    prisma.shopSetting.findUnique({
      where: { id: "default" },
      select: { defaultDollarRate: true },
    }),
  ]);

  const defaultDollarRate = Number(shopSetting?.defaultDollarRate || 127.5);

  const rateMap = new Map(
    rates.map((row) => {
      const usd = Number(row.usdAmount || 0);
      const bdt = Number(row.bdtAmount || 0);
      return [
        getBangladeshDateInputValue(row.rateDate),
        usd > 0 ? bdt / usd : 0,
      ] as const;
    })
  );

  function spendUsd(row: (typeof spends)[number]) {
    const amount = Number(row.amountSpent || 0);
    const currency = String(row.currency || "USD").toUpperCase();

    if (currency === "USD") return amount;
    if (currency === "BDT" || currency === "TK" || currency === "TAKA") {
      const rate = rateMap.get(getBangladeshDateInputValue(row.spendDate)) || defaultDollarRate;
      return rate > 0 ? amount / rate : 0;
    }
    return 0;
  }

  const totalRechargeUsd = recharges.reduce(
    (sum, row) => sum + Number(row.usdAmount || 0),
    0
  );
  const totalRechargeBdt = recharges.reduce(
    (sum, row) => sum + Number(row.bdtAmount || 0),
    0
  );
  const totalBurnUsd = spends.reduce((sum, row) => sum + spendUsd(row), 0);
  const balance = totalRechargeUsd - totalBurnUsd;
  const lowBalance = balance < 10;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Dollar Wallet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Admin recharge history and actual Meta/Facebook campaign burning for{" "}
          {merchant.name}.
        </p>

        {lowBalance ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Low Dollar Balance</p>
              <p className="mt-1 text-sm">
                Available balance is {formatUsd(balance)}. Recharge is required
                because the balance is below $10.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Current Balance" value={formatUsd(balance)} />
          <Stat label="Total Recharged" value={formatUsd(totalRechargeUsd)} />
          <Stat label="Meta Burned" value={formatUsd(totalBurnUsd)} />
          <Stat label="Recharge Cost BDT" value={formatTaka(totalRechargeBdt)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-950">
                Recharge History
              </h2>
            </div>
          </div>

          <div className="max-h-[650px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">USD</th>
                  <th className="px-4 py-3 text-right">BDT</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3">
                      {row.rechargeDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      +{formatUsd(Number(row.usdAmount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatTaka(Number(row.bdtAmount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatTaka(Number(row.usdRate))}/USD
                    </td>
                  </tr>
                ))}
                {!recharges.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No dollar recharge has been added yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-rose-600" />
              <h2 className="text-lg font-bold text-slate-950">
                Facebook Dollar Burning
              </h2>
            </div>
          </div>

          <div className="max-h-[650px] overflow-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date / Campaign</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-right">Meta Amount</th>
                  <th className="px-4 py-3 text-right">Wallet USD</th>
                </tr>
              </thead>
              <tbody>
                {spends.slice(0, 500).map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.spendDate.toISOString().slice(0, 10)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.campaignNameSnapshot}
                      </p>
                    </td>
                    <td className="px-4 py-3">{row.adAccount.name}</td>
                    <td className="px-4 py-3 text-right">
                      {String(row.currency).toUpperCase()}{" "}
                      {Number(row.amountSpent).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">
                      -{formatUsd(spendUsd(row))}
                    </td>
                  </tr>
                ))}
                {!spends.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No mapped Meta spend has burned this Merchant wallet yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="text-xs text-slate-400">
        USD ad accounts burn the wallet directly. BDT/Taka ad accounts are
        converted back to USD using that day&apos;s OMS Dollar Rate when available.
        Other unsupported currencies are not deducted from the USD wallet.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
