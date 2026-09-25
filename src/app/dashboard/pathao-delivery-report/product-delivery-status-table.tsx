"use client";

import { Fragment, useState } from "react";

type ChildRow = {
  key: string;
  childSku: string;
  productName: string;
  totalQty: number;
  statuses: Record<string, number>;
};

type ProductGroup = {
  key: string;
  parentCode: string;
  parentName: string;
  sourceName: string;
  sourceType: string;
  totalQty: number;
  statuses: Record<string, number>;
  skuRows: ChildRow[];
};

export default function ProductDeliveryStatusTable({
  groups,
  statusColumns,
  statusTotals,
  totalProductQty,
  dateLabel,
}: {
  groups: ProductGroup[];
  statusColumns: string[];
  statusTotals: Record<string, number>;
  totalProductQty: number;
  dateLabel: string;
}) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setOpenRows((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Product Delivery Status Report
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Parent Code wise report · click Parent Code to expand Child SKU details · {dateLabel}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          style={{ minWidth: `${760 + statusColumns.length * 145}px` }}
        >
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] bg-slate-50 px-4 py-3">
                Parent Code
              </th>
              <th className="min-w-[190px] px-4 py-3">Child SKU</th>
              <th className="min-w-[250px] px-4 py-3">Product Name</th>
              <th className="min-w-[190px] px-4 py-3">Source</th>
              <th className="min-w-[90px] px-4 py-3 text-center">Total Qty</th>
              {statusColumns.map((status) => (
                <th
                  key={status}
                  className="min-w-[145px] whitespace-normal px-3 py-3 text-center"
                >
                  {status}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => {
              const isOpen = Boolean(openRows[group.key]);

              return (
                <Fragment key={group.key}>
                  <tr className="border-t bg-white align-top">
                    <td className="sticky left-0 z-10 bg-white px-4 py-4">
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        className="text-left font-bold text-slate-900 hover:underline"
                        aria-expanded={isOpen}
                      >
                        <span className="mr-1">{isOpen ? "▼" : "▶"}</span>
                        {group.parentCode}
                      </button>
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {group.parentName}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {group.skuRows.length} child SKU{group.skuRows.length === 1 ? "" : "s"}
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-700">
                      Parent Total
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{group.sourceName}</p>
                      <p className="mt-1 text-xs text-slate-400">{group.sourceType}</p>
                    </td>

                    <td className="px-4 py-4 text-center text-lg font-bold text-slate-900">
                      {group.totalQty}
                    </td>

                    {statusColumns.map((status) => {
                      const qty = group.statuses[status] || 0;
                      return (
                        <td
                          key={status}
                          className={
                            "px-3 py-4 text-center font-bold " +
                            (qty ? "text-slate-900" : "text-slate-300")
                          }
                        >
                          {qty}
                        </td>
                      );
                    })}
                  </tr>

                  {isOpen &&
                    group.skuRows.map((sku) => (
                      <tr
                        key={sku.key}
                        className="border-t bg-slate-50 align-top"
                      >
                        <td className="sticky left-0 z-10 bg-slate-50 px-4 py-4 text-slate-300">
                          ↳
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {sku.childSku}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-800">{sku.productName}</p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-700">{group.sourceName}</p>
                          <p className="mt-1 text-xs text-slate-400">{group.sourceType}</p>
                        </td>

                        <td className="px-4 py-4 text-center font-bold text-slate-900">
                          {sku.totalQty}
                        </td>

                        {statusColumns.map((status) => {
                          const qty = sku.statuses[status] || 0;
                          return (
                            <td
                              key={status}
                              className={
                                "px-3 py-4 text-center font-semibold " +
                                (qty ? "text-slate-900" : "text-slate-300")
                              }
                            >
                              {qty}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })}

            {!groups.length ? (
              <tr>
                <td
                  colSpan={5 + statusColumns.length}
                  className="px-5 py-12 text-center text-slate-500"
                >
                  No product delivery data found for this date range and filter.
                </td>
              </tr>
            ) : null}
          </tbody>

          {groups.length ? (
            <tfoot className="border-t-2 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-900">
                  Total Product Qty
                </td>
                <td className="px-4 py-4 text-center text-lg font-bold text-slate-900">
                  {totalProductQty}
                </td>
                {statusColumns.map((status) => (
                  <td
                    key={status}
                    className="px-3 py-4 text-center font-bold text-slate-900"
                  >
                    {statusTotals[status] || 0}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
