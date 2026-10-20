"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  PackageCheck,
  Eye,
  EyeOff,
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
  deliveryCost: number;
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

function costMoney(value: number) {
  const amount = Math.abs(Number(value || 0));
  return "- Tk " + amount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resultMoney(value: number) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+ " : amount < 0 ? "- " : "";
  return sign + "Tk " + Math.abs(amount).toLocaleString("en-BD", {
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

function DetailedMetricCells({
  row,
  child = false,
}: {
  row: ProductPerformanceChildRow;
  child?: boolean;
}) {
  const courierCost = row.returnCharge + row.deliveryCost;
  const preAdsProfit =
    row.merchandiseSales - row.cogs - courierCost;
  const finalProfit = preAdsProfit - row.adsCost;
  const preAdsTone = preAdsProfit >= 0 ? "green" : "red";
  const finalTone = finalProfit >= 0 ? "green" : "red";
  const finalMargin =
    row.merchandiseSales > 0
      ? (finalProfit / row.merchandiseSales) * 100
      : 0;

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
      <NumberCell value={costMoney(row.returnCharge)} tone="red" />
      <NumberCell value={costMoney(row.deliveryCost)} tone="red" />
      <NumberCell value={money(row.invoicedTotal)} />
      <NumberCell value={costMoney(row.adsCost)} tone="violet" strong={!child} />
      <NumberCell value={money(row.merchandiseSales)} />
      <NumberCell value={costMoney(row.cogs)} tone="red" />
      <NumberCell value={resultMoney(preAdsProfit)} tone={preAdsTone} strong />
      <NumberCell
        value={resultMoney(finalProfit)}
        tone={finalTone}
        strong
        title="পণ্য বিক্রি − ক্রয়মূল্য − রিটার্ন চার্জ − ডেলিভারি খরচ − Ads খরচ"
      />
      <NumberCell value={pct(finalMargin)} tone={finalTone} />
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

function SimpleMetricCells({
  row,
  child = false,
}: {
  row: ProductPerformanceChildRow;
  child?: boolean;
}) {
  const returnCancelled =
    row.returnedToMerchantInvoices + row.cancelledInvoices;
  const courierCost = row.returnCharge + row.deliveryCost;
  const finalProfit =
    row.merchandiseSales - row.cogs - courierCost - row.adsCost;
  const finalTone = finalProfit >= 0 ? "green" : "red";

  return (
    <>
      <NumberCell value={row.qty.toLocaleString("en-BD")} strong={!child} />
      <NumberCell value={row.totalInvoices.toLocaleString("en-BD")} />
      <NumberCell
        value={row.deliveredInvoices.toLocaleString("en-BD")}
        tone="green"
        strong={!child}
      />
      <NumberCell value={returnCancelled.toLocaleString("en-BD")} tone="red" />
      <NumberCell
        value={row.pendingInvoices.toLocaleString("en-BD")}
        tone="amber"
      />
      <NumberCell value={money(row.merchandiseSales)} strong={!child} />
      <NumberCell value={costMoney(row.cogs)} tone="red" />
      <NumberCell value={costMoney(courierCost)} tone="red" />
      <NumberCell value={costMoney(row.adsCost)} tone="violet" />
      <NumberCell
        value={resultMoney(finalProfit)}
        tone={finalTone}
        strong
        title="Final লাভ/লস = পণ্য বিক্রি − ক্রয়মূল্য − কুরিয়ার খরচ − Ads খরচ"
      />
      <NumberCell value={pct(row.deliveryPercentage)} tone="green" />
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
  const [showDetailed, setShowDetailed] = useState(false);
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
    <section className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-2">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Parent Code পারফরম্যান্স রিপোর্ট
              </h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                প্রতিটি Parent Code-এর বিক্রি, ডেলিভারি, খরচ ও লাভ এক জায়গায়।
                ডিফল্টভাবে সহজ রিপোর্ট দেখানো হয়; প্রয়োজন হলে বিস্তারিত রিপোর্ট খুলুন।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Parent Code {totals.parents}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              মোট পণ্য {totals.qty.toLocaleString("en-BD")}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              ডেলিভার্ড পণ্য {totals.deliveredProductQty.toLocaleString("en-BD")}
            </span>
            <button
              type="button"
              onClick={() => setShowDetailed((value) => !value)}
              className={
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm " +
                (showDetailed
                  ? "border-slate-300 bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {showDetailed ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {showDetailed ? "সহজ রিপোর্ট দেখুন" : "বিস্তারিত রিপোর্ট দেখুন"}
            </button>

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
                {allExpanded ? "সব মিনিমাইজ" : "সব খুলুন"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500 sm:px-6">
        <span>
          {showDetailed
            ? "বিস্তারিত রিপোর্টে সব হিসাব আলাদা কলামে দেখানো হচ্ছে।"
            : "সহজ রিপোর্টে প্রয়োজনীয় হিসাবগুলো সংক্ষেপে দেখানো হচ্ছে।"}
        </span>
        <span className="hidden shrink-0 rounded-lg border bg-white px-2.5 py-1 font-semibold text-slate-600 shadow-sm lg:inline-flex">
          ডেস্কটপ: Space ধরে বামে/ডানে drag করুন
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
        style={{
          scrollbarGutter: "stable",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || !spaceHeld || event.button !== 0) return;

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
        <table
          className={
            (showDetailed ? "min-w-[3020px]" : "min-w-[1840px]") +
            " w-full text-sm"
          }
        >
          <thead className="sticky top-0 z-30 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
            <tr>
              <th className="top-0 z-40 min-w-[220px] bg-slate-50 px-4 py-3 shadow-[1px_0_0_rgba(148,163,184,0.25)] sm:min-w-[260px] md:sticky md:left-0 md:min-w-[300px]">
                Parent Code / Child SKU
              </th>
              <th className="min-w-[310px] px-4 py-3">সোর্স / ক্যাম্পেইন</th>
              {showDetailed ? (
                <>
                  <th className="px-4 py-3 text-right">পণ্য Qty</th>
                  <th className="px-4 py-3 text-right">মোট ইনভয়েস</th>
                  <th className="px-4 py-3 text-right">ডেলিভার্ড</th>
                  <th className="px-4 py-3 text-right">রিটার্ন</th>
                  <th className="px-4 py-3 text-right">বাতিল</th>
                  <th className="px-4 py-3 text-right">পেন্ডিং</th>
                  <th className="px-4 py-3 text-right">− রিটার্ন চার্জ</th>
                  <th className="px-4 py-3 text-right">− ডেলিভারি খরচ</th>
                  <th className="px-4 py-3 text-right">Pathao ইনভয়েস মূল্য</th>
                  <th className="px-4 py-3 text-right">− Ads খরচ</th>
                  <th className="px-4 py-3 text-right">পণ্য বিক্রি</th>
                  <th className="px-4 py-3 text-right">− পণ্য ক্রয়মূল্য</th>
                  <th className="px-4 py-3 text-right">Ads-এর আগে লাভ</th>
                  <th className="px-4 py-3 text-right">Final লাভ / লস</th>
                  <th className="px-4 py-3 text-right">Final লাভ %</th>
                  <th className="px-4 py-3 text-right">ডেলিভারি %</th>
                  <th className="px-4 py-3 text-right">প্রতি ডেলিভারি Ads খরচ</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-right">পণ্য Qty</th>
                  <th className="px-4 py-3 text-right">মোট ইনভয়েস</th>
                  <th className="px-4 py-3 text-right">ডেলিভার্ড</th>
                  <th className="px-4 py-3 text-right">ফেরত / বাতিল</th>
                  <th className="px-4 py-3 text-right">পেন্ডিং</th>
                  <th className="px-4 py-3 text-right">পণ্য বিক্রি</th>
                  <th className="px-4 py-3 text-right">− ক্রয়মূল্য</th>
                  <th className="px-4 py-3 text-right">− কুরিয়ার</th>
                  <th className="px-4 py-3 text-right">− Ads</th>
                  <th className="px-4 py-3 text-right">= Final লাভ / লস</th>
                  <th className="px-4 py-3 text-right">ডেলিভারি %</th>
                </>
              )}
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
                    <td className="z-20 min-w-[220px] bg-white px-4 py-3 shadow-[1px_0_0_rgba(226,232,240,0.9)] sm:min-w-[260px] md:sticky md:left-0 md:min-w-[300px]">
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
                              {row.children.length}টি Child/Source ·{" "}
                              {isOpen ? "মিনিমাইজ করুন" : "বিস্তারিত দেখুন"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">
                        {sourceCount
                          ? sourceCount + " সোর্স"
                          : "সোর্স নেই"}
                        {" · "}
                        {row.campaignNames.length + " ক্যাম্পেইন গ্রুপ"}
                      </p>
                      <CampaignList names={row.campaignNames} />
                      <p className="mt-1 text-[11px] text-slate-400">
                        ডেলিভার্ড পণ্য:{" "}
                        {row.deliveredProductQty.toLocaleString("en-BD")}
                      </p>
                    </td>

                    {showDetailed ? (
                      <DetailedMetricCells row={row} />
                    ) : (
                      <SimpleMetricCells row={row} />
                    )}
                  </tr>

                  {isOpen
                    ? row.children.map((child) => (
                        <tr
                          key={row.key + "::" + child.key}
                          className="border-t bg-slate-50/80 align-top"
                        >
                          <td className="z-20 min-w-[220px] bg-slate-50 px-4 py-3 shadow-[1px_0_0_rgba(226,232,240,0.9)] sm:min-w-[260px] md:sticky md:left-0 md:min-w-[300px]">
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
                              ডেলিভার্ড পণ্য:{" "}
                              {child.deliveredProductQty.toLocaleString("en-BD")}
                            </p>
                          </td>

                          {showDetailed ? (
                            <DetailedMetricCells row={child} child />
                          ) : (
                            <SimpleMetricCells row={child} child />
                          )}
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}

            {!rows.length ? (
              <tr>
                <td
                  colSpan={showDetailed ? 19 : 13}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  নির্বাচিত ফিল্টারে কোনো Pathao পণ্যের তথ্য পাওয়া যায়নি।
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="border-t bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-600 sm:px-6">
        {showDetailed ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <p><strong>পণ্য Qty:</strong> নির্বাচিত সময়ের Ready-to-Ship ইনভয়েসে মোট পণ্যের সংখ্যা।</p>
            <p><strong>মোট ইনভয়েস:</strong> ঐ Parent Code-এর আলাদা ইনভয়েস সংখ্যা।</p>
            <p><strong>পেন্ডিং:</strong> Delivered / Return / Cancelled হয়নি—এমন সর্বশেষ verified Pathao status.</p>
            <p><strong>ডেলিভারি %:</strong> Delivered invoice ÷ Total Invoice × 100.</p>
            <p><strong>প্রতি ডেলিভারি Ads খরচ:</strong> Ads Cost ÷ delivered product quantity.</p>
            <p><strong>Ads-এর আগে লাভ:</strong> পণ্য বিক্রি − ক্রয়মূল্য − রিটার্ন চার্জ − ডেলিভারি খরচ।</p>
            <p><strong>Final লাভ / লস:</strong> Ads-এর আগে লাভ − Ads খরচ। এটিই product-level final result.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p>
              <strong>সহজ হিসাব:</strong> পণ্য বিক্রি − ক্রয়মূল্য − কুরিয়ার খরচ − Ads খরচ
              = <strong>Final লাভ / লস</strong>।
            </p>
            <p>
              কুরিয়ার খরচের মধ্যে <strong>ডেলিভারি খরচ + রিটার্ন চার্জ</strong> দুটোই আছে।
              Final result সবুজ <strong>+</strong> হলে লাভ, লাল <strong>−</strong> হলে লস।
              Salary / Office overhead এখানে ভাগ করা হয়নি; সেগুলো উপরের Company Net Profit-এ হিসাব হয়।
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
