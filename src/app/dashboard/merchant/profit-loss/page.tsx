import { AlertTriangle, CircleDollarSign, Megaphone, ReceiptText, Truck } from "lucide-react";

import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { calculateMerchantProfitLoss } from "@/lib/merchant-profit";
import {
  formatTaka,
  requireMerchantContext,
  validDate,
} from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

export default async function MerchantProfitLossPage({ searchParams }: Props) {
  const { merchant } = await requireMerchantContext();
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const report = await calculateMerchantProfitLoss(merchant.id, from, to);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Profit & Loss
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {merchant.name} · Same Pathao realized-revenue, COGS, courier-fee
              and Meta spend rules used by OMS, scoped to this Merchant. Only
              date range filtering is available here.
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

        {report.missingDollarRateDays.length ||
        report.unsupportedAdCurrencies.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Ads conversion needs attention</p>
                {report.missingDollarRateDays.length ? (
                  <p className="mt-1">
                    Missing OMS Dollar Rate:{" "}
                    {report.missingDollarRateDays.join(", ")}
                  </p>
                ) : null}
                {report.unsupportedAdCurrencies.length ? (
                  <p className="mt-1">
                    Unsupported ad currency:{" "}
                    {report.unsupportedAdCurrencies.join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Delivered Revenue"
          value={formatTaka(report.realizedRevenue)}
          sub="Pathao COD + customer advance, Merchant line share"
          icon={CircleDollarSign}
        />
        <Metric
          label="Product COGS"
          value={formatTaka(report.productCogs)}
          sub="Variation / Parent Stock / Bundle rules"
          icon={ReceiptText}
          negative
        />
        <Metric
          label="Pathao Delivery Cost"
          value={formatTaka(report.deliveryCost)}
          sub="Verified delivery fee, Merchant line share"
          icon={Truck}
          negative
        />
        <Metric
          label="Pathao Return Cost"
          value={formatTaka(report.returnCost)}
          sub="Paid Return webhook fee"
          icon={Truck}
          negative
        />
        <Metric
          label="Meta Ads"
          value={formatTaka(report.metaAds)}
          sub="Campaigns assigned to this Merchant in Ads Cost Sync"
          icon={Megaphone}
          negative
        />
        <Metric
          label="Operating Cost"
          value={formatTaka(report.operatingCost)}
          sub="Admin monthly cost, prorated to selected dates"
          icon={ReceiptText}
          negative
        />
        <Metric
          label="Net Profit"
          value={formatTaka(report.netProfit)}
          sub={
            "Revenue − COGS − Delivery − Return − Ads − Operating Cost"
          }
          icon={CircleDollarSign}
          positive={report.netProfit >= 0}
          negative={report.netProfit < 0}
        />
        <Metric
          label="Net Margin"
          value={report.netMargin.toFixed(2) + "%"}
          sub="Net Profit ÷ Delivered Revenue"
          icon={CircleDollarSign}
          positive={report.netMargin >= 0}
          negative={report.netMargin < 0}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SmallStat label="Delivered Orders" value={report.deliveredOrders} />
        <SmallStat label="Returned Orders" value={report.returnedOrders} />
        <SmallStat
          label="Delivered Product Qty"
          value={report.deliveredProductQty}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Monthly Operating Cost Applied
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Full-month Admin cost is prorated when the selected range covers
              only part of a month.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[620px] w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Month</th>
                  <th className="px-4 py-3 text-right">Full Cost</th>
                  <th className="px-4 py-3 text-right">Days Applied</th>
                  <th className="px-4 py-3 text-right">Applied Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.operatingCostRows.map((row) => (
                  <tr key={row.month} className="border-t">
                    <td className="px-4 py-3 font-semibold">{row.month}</td>
                    <td className="px-4 py-3 text-right">
                      {formatTaka(row.fullAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.daysUsed}/{row.daysInMonth}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatTaka(row.appliedAmount)}
                    </td>
                  </tr>
                ))}
                {!report.operatingCostRows.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No Merchant operating cost exists for this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Meta Ads Applied
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Spend is selected by the Merchant column in Ads Cost Sync.
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date / Campaign</th>
                  <th className="px-4 py-3 text-right">Meta Amount</th>
                  <th className="px-4 py-3 text-right">BDT Applied</th>
                </tr>
              </thead>
              <tbody>
                {report.adRows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.date}</p>
                      <p className="mt-1 max-w-[420px] text-xs text-slate-500">
                        {row.campaign}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.currency} {row.nativeAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatTaka(row.bdtAmount)}
                    </td>
                  </tr>
                ))}
                {!report.adRows.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No Merchant-mapped Meta spend in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
        <p>
          <strong>Realized Revenue</strong> follows OMS accounting: Pathao COD
          collected + Customer Advance. Mixed invoices are allocated by the
          Merchant product-line value so the full invoice is never duplicated.
        </p>
        <p className="mt-2">
          <strong>Net Profit</strong> = Delivered Revenue − Product COGS −
          Pathao Delivery Cost − Pathao Paid Return Cost − Meta Ads − Merchant
          Operating Cost.
        </p>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon: Icon,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof CircleDollarSign;
  positive?: boolean;
  negative?: boolean;
}) {
  const valueClass = positive
    ? "text-emerald-700"
    : negative
      ? "text-rose-700"
      : "text-slate-950";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className={"mt-3 text-2xl font-extrabold " + valueClass}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{sub}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-950">
        {value.toLocaleString("en-BD")}
      </p>
    </div>
  );
}
