"use client";

import { Fragment, useState } from "react";

type ReportChildRow = {
  id: string;
  campaignName: string;
  adAccountName: string;
  adAccountId: string;
  currency: string;
  spendAmount: number;
  spendUsd: number;
  spendBdt: number;
  dollarRate: number;
  metaPurchases: number;
};

type ReportRow = {
  id: string;
  dataSource: "META" | "CSV";
  parentSku: string;
  parentName: string;
  campaignName: string;
  adAccountName: string;
  adAccountId: string;
  currency: string;
  sourceNames: string[];
  spendAmount: number;
  spendBdt: number;
  dollarRate: number;
  purchasePrice: number;
  totalOrders: number;
  confirmed: number;
  cancelled: number;
  confirmationRate: number;
  costPerOrderBdt: number;
  costPerConfirmedBdt: number;
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

function metaCount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function AdsCostPerformanceTable({
  rows,
  dataSource,
}: {
  rows: ReportRow[];
  dataSource: "META" | "CSV";
}) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setOpenRows((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Campaign Performance Report
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          OMS orders are matched by order-created date. Connected campaigns
          are merged before OMS order metrics are calculated.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1900px] w-full">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <Th>Product Parent</Th>
              <Th>Campaign / Group</Th>
              <Th>Ad Account</Th>
              <Th>Mapped Sources</Th>
              <Th center>Total Orders</Th>
              <Th center>Confirmed</Th>
              <Th center>Cancelled</Th>
              <Th center>Confirm %</Th>
              <Th center>Meta Purchases</Th>
              <Th center>Purchase Price</Th>
              <Th center>Dollar Rate</Th>
              <Th center>Ads Spend</Th>
              <Th center>Ads Spend BDT</Th>
              <Th center>Cost / Order USD</Th>
              <Th center>Cost / Order BDT</Th>
              <Th center>Cost / Confirmed BDT</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isOpen = Boolean(openRows[row.id]);

              return (
                <Fragment key={row.id}>
                  <tr className="border-b align-top last:border-b-0">
                    <td className="px-5 py-4 text-sm">
                      <p className="font-semibold text-slate-900">
                        {row.parentSku}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.parentName}
                      </p>
                    </td>

                    <Td>
                      {row.isGroup ? (
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          className="max-w-80 text-left font-semibold text-slate-900 hover:underline"
                        >
                          {isOpen ? "▼" : "▶"} {row.campaignName}
                        </button>
                      ) : (
                        <span>{row.campaignName}</span>
                      )}
                      {row.isGroup ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {row.children.length} connected campaigns
                        </p>
                      ) : null}
                    </Td>

                    <Td>
                      <p>{row.adAccountName}</p>
                      {row.adAccountId ? (
                        <p className="mt-1 max-w-64 text-xs text-slate-400">
                          {row.adAccountId}
                        </p>
                      ) : null}
                    </Td>

                    <Td>
                      <div className="max-w-64">
                        {row.sourceNames.join(", ")}
                      </div>
                    </Td>

                    <Td center>{row.totalOrders}</Td>
                    <Td center>{row.confirmed}</Td>
                    <Td center>{row.cancelled}</Td>
                    <Td center>{row.confirmationRate.toFixed(2)}%</Td>
                    <Td center>
                      {row.metaPurchases == null
                        ? "—"
                        : metaCount(row.metaPurchases)}
                    </Td>
                    <Td center>{money(row.purchasePrice)}</Td>
                    <Td center>
                      {row.dollarRate > 0 ? money(row.dollarRate) : "No Rate"}
                    </Td>
                    <Td center>
                      {currencyAmount(row.spendAmount, row.currency)}
                    </Td>
                    <Td center>{money(row.spendBdt)}</Td>
                    <Td center>
                      {row.confirmed > 0
                        ? usd(row.spendUsd / row.confirmed)
                        : "$ 0.00"}
                    </Td>
                    <Td center>{money(row.costPerOrderBdt)}</Td>
                    <Td center>{money(row.costPerConfirmedBdt)}</Td>
                  </tr>

                  {row.isGroup &&
                    isOpen &&
                    row.children.map((child) => (
                      <tr
                        key={child.id}
                        className="border-b bg-slate-50 align-top"
                      >
                        <td className="px-5 py-4 text-sm text-slate-300">↳</td>
                        <td className="px-5 py-4 text-sm">
                          <p className="font-semibold text-slate-800">
                            {child.campaignName}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Individual Meta campaign
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>{child.adAccountName}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {child.adAccountId}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          Same group mapping
                        </td>
                        <Dash /><Dash /><Dash /><Dash />
                        <Td center>{metaCount(child.metaPurchases)}</Td>
                        <Dash />
                        <Td center>
                          {child.dollarRate > 0
                            ? money(child.dollarRate)
                            : "No Rate"}
                        </Td>
                        <Td center>
                          {currencyAmount(child.spendAmount, child.currency)}
                        </Td>
                        <Td center>{money(child.spendBdt)}</Td>
                        <Dash /><Dash /><Dash />
                      </tr>
                    ))}
                </Fragment>
              );
            })}

            {!rows.length ? (
              <tr>
                <td
                  colSpan={16}
                  className="px-6 py-10 text-center text-sm text-slate-500"
                >
                  {dataSource === "META"
                    ? "No mapped Meta campaign spend found for this filter. Sync Meta spend and map campaigns first."
                    : "No CSV ads-cost data found for this filter."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Dash() {
  return (
    <td className="px-5 py-4 text-center text-sm text-slate-300">—</td>
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
      className={
        "px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 " +
        (center ? "text-center" : "text-left")
      }
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
      className={
        "px-5 py-4 text-sm text-slate-700 " +
        (center ? "text-center" : "text-left")
      }
    >
      {children}
    </td>
  );
}
