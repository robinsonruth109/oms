"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  PackageCheck,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

export type ProductPerformanceChildRow = {
  key: string;
  sku: string;
  name: string;
  sourceName: string;
  sourceType: string;
  campaignNames: string[];
  qty: number;
  totalInvoices: number;
  deliveredInvoices: number;
  returnedToMerchantInvoices: number;
  cancelledInvoices: number;
  pendingInvoices: number;
  deliveredProductQty: number;
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
  title,
}: {
  value: number | string;
  tone?: "green" | "red" | "amber" | "violet";
  strong?: boolean;
  title?: string;
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
      title={title}
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
      <NumberCell
        value={row.deliveredInvoices.toLocaleString("en-BD")}
        tone="green"
        strong={!child}
      />
      <NumberCell
        value={row.returnedToMerchantInvoices.toLocaleString("en-BD")}
        tone="red"
      />
      <NumberCell
        value={row.cancelledInvoices.toLocaleString("en-BD")}
        tone="red"
      />
      <NumberCell
        value={row.pendingInvoices.toLocaleString("en-BD")}
        tone="amber"
      />
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
          row.deliveredProductQty > 0 && row.adsCost > 0
            ? money(row.costPerDeliveredProduct)
            : "—"
        }
        tone="violet"
        title={
          row.deliveredProductQty > 0
            ? "Ads Cost BDT ÷ " +
              row.deliveredProductQty.toLocaleString("en-BD") +
              " delivered product unit(s)"
            : "No delivered product quantity"
        }
      />
    </>
  );
}

function CampaignList({ names }: { names: string[] }) {
  if (!names.length) {
    return <p className="mt-1 text-[11px] text-slate-400">No mapped Meta campaign</p>;
  }

  const visible = names.slice(0, 2);
  return (
    <div className="mt-1.5 flex max-w-[340px] flex-wrap gap-1">
      {visible.map((name) => (
        <span
          key={name}
          title={name}
          className="max-w-[260px] truncate rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700"
        >
          {name}
        </span>
      ))}
      {names.length > visible.length ? (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          +{names.length - visible.length} more
        </span>
      ) : null}
    </div>
  );
}

export default function ProductPerformanceReport({
  rows,
}: {
  rows: ParentProductPerformanceRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return false;

      return (
        element.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(element.tagName)
      );
    }

    function stopDrag() {
      dragRef.current = null;
      setIsDragging(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setSpaceHeld(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      setSpaceHeld(false);
      stopDrag();
    }

    function onBlur() {
      setSpaceHeld(false);
      stopDrag();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const totals = useMemo(
    () => ({
      parents: rows.length,
      qty: rows.reduce((sum, row) => sum + row.qty, 0),
      deliveredProductQty: rows.reduce(
        (sum, row) => sum + row.deliveredProductQty,
        0
      ),
    }),
    [rows]
  );

  const allExpanded =
    rows.length > 0 && rows.every((row) => expanded.has(row.key));

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(rows.map((row) => row.key)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-2">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Parent Code Performance Report
              </h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                One strong summary row per Parent Code. Expand a parent to see
                Child SKU + Source detail and the mapped Meta campaign/group
                context behind the attributed ad cost.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {totals.parents} parent code(s)
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              Qty {totals.qty.toLocaleString("en-BD")}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Delivered product qty {totals.deliveredProductQty.toLocaleString("en-BD")}
            </span>
            {rows.length ? (
              <button
                type="button"
                onClick={allExpanded ? collapseAll : expandAll}
                className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {allExpanded ? (
                  <ChevronsUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsDown className="h-3.5 w-3.5" />
                )}
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500 sm:px-6">
        <span>
          The report list scrolls inside this panel while the column heading stays visible.
        </span>
        <span className="hidden shrink-0 rounded-lg border bg-white px-2.5 py-1 font-semibold text-slate-600 shadow-sm lg:inline-flex">
          Desktop: hold Space + click-drag left/right
        </span>
      </div>

      <div
        ref={scrollRef}
        className={
          "relative max-h-[68vh] min-h-[360px] overflow-auto overscroll-contain " +
          (spaceHeld
            ? isDragging
              ? "cursor-grabbing select-none"
              : "cursor-grab"
            : "")
        }
        style={{ scrollbarGutter: "stable" }}
        onPointerDown={(event) => {
          if (!spaceHeld || event.button !== 0) return;

          const scroller = scrollRef.current;
          if (!scroller) return;

          event.preventDefault();
          suppressClickRef.current = true;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: scroller.scrollLeft,
          };
          scroller.setPointerCapture(event.pointerId);
          setIsDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const scroller = scrollRef.current;
          if (!drag || !scroller || drag.pointerId !== event.pointerId) return;

          const deltaX = event.clientX - drag.startX;
          scroller.scrollLeft = drag.startScrollLeft - deltaX;
        }}
        onPointerUp={(event) => {
          const scroller = scrollRef.current;
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;

          if (scroller?.hasPointerCapture(event.pointerId)) {
            scroller.releasePointerCapture(event.pointerId);
          }
          dragRef.current = null;
          setIsDragging(false);
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }}
        onPointerCancel={(event) => {
          const scroller = scrollRef.current;
          if (scroller?.hasPointerCapture(event.pointerId)) {
            scroller.releasePointerCapture(event.pointerId);
          }
          dragRef.current = null;
          setIsDragging(false);
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }}
        onClickCapture={(event) => {
          if (!spaceHeld && !suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <table className="min-w-[2660px] w-full text-sm">
          <thead className="sticky top-0 z-30 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
            <tr>
              <th className="sticky left-0 top-0 z-40 min-w-[300px] bg-slate-50 px-4 py-3 shadow-[1px_0_0_rgba(148,163,184,0.25)]">
                Parent Code / Child SKU
              </th>
              <th className="min-w-[310px] px-4 py-3">Source / Campaign</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Total Invoice</th>
              <th className="px-4 py-3 text-right">Pathao Delivered</th>
              <th className="px-4 py-3 text-right">Pathao Return to Merchant</th>
              <th className="px-4 py-3 text-right">Pathao Cancelled</th>
              <th className="px-4 py-3 text-right">Pathao Pending</th>
              <th className="px-4 py-3 text-right">Pathao Return Charge</th>
              <th className="px-4 py-3 text-right">Pathao Invoiced Total</th>
              <th className="px-4 py-3 text-right">Ads Costing BDT</th>
              <th className="px-4 py-3 text-right">Merchandise Sales</th>
              <th className="px-4 py-3 text-right">COGS</th>
              <th className="px-4 py-3 text-right">Gross Profit</th>
              <th className="px-4 py-3 text-right">Margin %</th>
              <th className="px-4 py-3 text-right">Delivery %</th>
              <th className="px-4 py-3 text-right">Cost / Delivered Product</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.key);
              const sourceCount = new Set(
                row.children.map((child) => child.sourceName).filter(Boolean)
              ).size;

              return (
                <Fragment key={row.key}>
                  <tr className="border-t bg-white align-top transition hover:bg-slate-50">
                    <td className="sticky left-0 z-20 bg-white px-4 py-3 shadow-[1px_0_0_rgba(226,232,240,0.9)]">
                      <button
                        type="button"
                        onClick={() => toggle(row.key)}
                        className="flex w-full items-start gap-2 text-left"
                        aria-expanded={isOpen}
                      >
                        {row.children.length ? (
                          isOpen ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                          )
                        ) : (
                          <span className="mt-1 block h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block text-base font-extrabold text-slate-950">
                            {row.sku}
                          </span>
                          <span className="mt-0.5 block text-xs font-medium text-slate-500">
                            {row.name}
                          </span>
                          {row.children.length ? (
                            <span className="mt-1 block text-[11px] font-semibold text-blue-600">
                              {row.children.length} child/source row(s) ·{" "}
                              {isOpen ? "click to minimize" : "click to expand"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">
                        {sourceCount
                          ? sourceCount + " source" + (sourceCount === 1 ? "" : "s")
                          : "No source detail"}
                        {" · "}
                        {row.campaignNames.length +
                          " campaign group" +
                          (row.campaignNames.length === 1 ? "" : "s")}
                      </p>
                      <CampaignList names={row.campaignNames} />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Delivered product qty:{" "}
                        {row.deliveredProductQty.toLocaleString("en-BD")}
                      </p>
                    </td>

                    <MetricCells row={row} />
                  </tr>

                  {isOpen
                    ? row.children.map((child) => (
                        <tr
                          key={row.key + "::" + child.key}
                          className="border-t bg-slate-50/80 align-top"
                        >
                          <td className="sticky left-0 z-20 bg-slate-50 px-4 py-3 shadow-[1px_0_0_rgba(226,232,240,0.9)]">
                            <div className="pl-6">
                              <p className="font-bold text-slate-800">
                                ↳ {child.sku}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {child.name}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">
                              {child.sourceName || "Unknown Source"}
                            </p>
                            {child.sourceType ? (
                              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                                {child.sourceType}
                              </p>
                            ) : null}
                            <CampaignList names={child.campaignNames} />
                            <p className="mt-1 text-[11px] text-slate-400">
                              Delivered product qty:{" "}
                              {child.deliveredProductQty.toLocaleString("en-BD")}
                            </p>
                          </td>

                          <MetricCells row={child} child />
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}

            {!rows.length ? (
              <tr>
                <td
                  colSpan={17}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No Pathao product activity found in the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-600 md:grid-cols-2 xl:grid-cols-3 sm:px-6">
        <p>
          <strong>Qty</strong> is OrderItem product quantity. The four Pathao
          outcome columns are distinct invoice counts, so one invoice is placed
          in only one final bucket.
        </p>
        <p>
          <strong>Pathao Pending</strong> means every latest verified Pathao
          status that is not Delivered, final Returned to Merchant/Paid Return,
          or Cancelled.
        </p>
        <p>
          <strong>Delivery %</strong> = Pathao Delivered invoice count ÷ Total
          Invoice × 100.
        </p>
        <p>
          <strong>Cost / Delivered Product</strong> = attributed Ads Costing BDT
          ÷ delivered product quantity, not delivered invoices.
        </p>
        <p>
          <strong>Ads Costing BDT</strong> is attributed once at Parent Code
          level. Connected campaign groups are displayed together; child/source
          rows only allocate that parent amount and sum back to the parent.
        </p>
        <p>
          <strong>Gross Profit</strong> = Merchandise Sales − COGS. Pathao
          invoice money is allocated by order-line value so a multi-product
          invoice is not duplicated into every Parent Code.
        </p>
      </div>
    </section>
  );
}
