"use client";

import { ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";

export type ProductPerformanceChildRow = {
  key: string;
  sku: string;
  name: string;
  qty: number;
  totalInvoices: number;
  deliveredQty: number;
  returnedToMerchantQty: number;
  cancelledQty: number;
  pendingQty: number;
  returnCharge: number;
  invoicedTotal: number;
  adsCost: number;
  merchandiseSales: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  deliveryPercentage: number;
  costPerDeliveredProduct: number;
};

export type ParentProductPerformanceRow = ProductPerformanceChildRow & {
  parentId: string;
  children: ProductPerformanceChildRow[];
};

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(value: number) {
  return Number(value || 0).toFixed(2) + "%";
}

function NumberCell({
  value,
  tone,
  strong,
}: {
  value: number | string;
  tone?: "green" | "red" | "amber" | "violet";
  strong?: boolean;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "violet"
            ? "text-violet-700"
            : "text-slate-700";

  return (
    <td
      className={
        "whitespace-nowrap px-4 py-3 text-right " +
        toneClass +
        (strong ? " font-bold" : "")
      }
    >
      {value}
    </td>
  );
}

function MetricCells({
  row,
  child = false,
}: {
  row: ProductPerformanceChildRow;
  child?: boolean;
}) {
  const profitTone = row.grossProfit >= 0 ? "green" : "red";

  return (
    <>
      <NumberCell value={row.qty.toLocaleString("en-BD")} strong={!child} />
      <NumberCell value={row.totalInvoices.toLocaleString("en-BD")} />
      <NumberCell value={row.deliveredQty.toLocaleString("en-BD")} tone="green" strong={!child} />
      <NumberCell value={row.returnedToMerchantQty.toLocaleString("en-BD")} tone="red" />
      <NumberCell value={row.cancelledQty.toLocaleString("en-BD")} tone="red" />
      <NumberCell value={row.pendingQty.toLocaleString("en-BD")} tone="amber" />
      <NumberCell value={money(row.returnCharge)} tone="red" />
      <NumberCell value={money(row.invoicedTotal)} />
      <NumberCell value={money(row.adsCost)} tone="violet" strong={!child} />
      <NumberCell value={money(row.merchandiseSales)} />
      <NumberCell value={money(row.cogs)} />
      <NumberCell value={money(row.grossProfit)} tone={profitTone} strong />
      <NumberCell value={pct(row.margin)} />
      <NumberCell value={pct(row.deliveryPercentage)} tone="green" />
      <NumberCell
        value={
          row.deliveredQty > 0 && row.adsCost > 0
            ? money(row.costPerDeliveredProduct)
            : "—"
        }
        tone="violet"
      />
    </>
  );
}

export default function ProductPerformanceReport({
  rows,
}: {
  rows: ParentProductPerformanceRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const totals = useMemo(
    () => ({
      parents: rows.length,
      qty: rows.reduce((sum, row) => sum + row.qty, 0),
      invoices: rows.reduce((sum, row) => sum + row.totalInvoices, 0),
      delivered: rows.reduce((sum, row) => sum + row.deliveredQty, 0),
    }),
    [rows]
  );

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">
              Parent Product Delivery & Profit Report
            </h2>
            <p className="mt-1 max-w-4xl text-xs text-slate-500">
              Parent-code summary by verified Pathao webhook outcome. Expand a
              parent to see child SKU results. Status columns are product
              quantity; Total Invoice is distinct OMS invoice count.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
            {totals.parents} parent code(s)
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
            Qty {totals.qty.toLocaleString("en-BD")}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
            Delivered {totals.delivered.toLocaleString("en-BD")}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border">
        <table className="min-w-[2350px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-[320px] bg-slate-50 px-4 py-3">
                Parent Code / Child SKU
              </th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Total Invoice</th>
              <th className="px-4 py-3 text-right">Pathao Delivered</th>
              <th className="px-4 py-3 text-right">Return to Merchant</th>
              <th className="px-4 py-3 text-right">Cancelled</th>
              <th className="px-4 py-3 text-right">Pending / Other</th>
              <th className="px-4 py-3 text-right">Return Charge</th>
              <th className="px-4 py-3 text-right">Pathao Invoiced Total</th>
              <th className="px-4 py-3 text-right">Ads Cost BDT</th>
              <th className="px-4 py-3 text-right">Merchandise Sales</th>
              <th className="px-4 py-3 text-right">COGS</th>
              <th className="px-4 py-3 text-right">Gross Profit</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-right">Delivery %</th>
              <th className="px-4 py-3 text-right">Cost / Delivered Product</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.key);
              return (
                <>
                  <tr
                    key={row.key}
                    className="border-t bg-white transition hover:bg-slate-50"
                  >
                    <td className="sticky left-0 z-[5] bg-white px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(row.key)}
                        className="flex w-full items-start gap-2 text-left"
                        aria-expanded={isOpen}
                      >
                        {row.children.length ? (
                          isOpen ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          )
                        ) : (
                          <span className="mt-1 block h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-950">
                            {row.sku}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {row.name}
                          </span>
                          {row.children.length ? (
                            <span className="mt-1 block text-[11px] font-medium text-blue-600">
                              {row.children.length} child SKU(s) ·{" "}
                              {isOpen ? "click to minimize" : "click to expand"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>
                    <MetricCells row={row} />
                  </tr>

                  {isOpen
                    ? row.children.map((child) => (
                        <tr
                          key={row.key + "::" + child.key}
                          className="border-t bg-slate-50/70"
                        >
                          <td className="sticky left-0 z-[5] bg-slate-50 px-4 py-3">
                            <div className="pl-6">
                              <p className="font-semibold text-slate-800">
                                ↳ {child.sku}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {child.name}
                              </p>
                            </div>
                          </td>
                          <MetricCells row={child} child />
                        </tr>
                      ))
                    : null}
                </>
              );
            })}

            {!rows.length ? (
              <tr>
                <td
                  colSpan={16}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No Pathao product activity found in the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
        <p>
          <strong>Delivery %</strong> = Pathao Delivered product quantity ÷
          total product quantity × 100.
        </p>
        <p>
          <strong>Cost / Delivered Product</strong> = attributed Ads Cost BDT ÷
          delivered product quantity.
        </p>
        <p>
          <strong>Pending / Other</strong> includes every latest verified Pathao
          status that is not Delivered, Returned to Merchant/Paid Return, or
          Cancelled.
        </p>
        <p>
          <strong>Pathao Invoiced Total</strong> allocates the full OMS invoice
          value (including advance) across product lines, preventing
          multi-product invoices from being counted more than once.
        </p>
      </div>
    </section>
  );
}
