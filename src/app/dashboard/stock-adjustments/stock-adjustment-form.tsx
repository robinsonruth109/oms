"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProductStockAdjustment,
  type StockAdjustmentActionState,
} from "./actions";

type Props = {
  product: {
    id: string;
    parentSku: string;
    sku: string;
    name: string;
    stockMode: "VARIANT_STOCK" | "PARENT_STOCK" | "BUNDLE";
    bundleUnitCost: number;
    componentSummary: string;
    stockVerified: boolean;
    currentStock: number;
    unitsPerSale: number;
    unitCost: number;
  };
  today: string;
};

const initialState: StockAdjustmentActionState = {
  success: false,
  message: "",
  warning: false,
};

function money(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function StockAdjustmentForm({ product, today }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createProductStockAdjustment,
    initialState
  );
  const needsFirstCount = product.stockMode !== "BUNDLE" && !product.stockVerified;
  const [quantity, setQuantity] = useState(needsFirstCount ? "" : "1");
  const [type, setType] = useState<"ADD" | "REDUCE" | "SET_COUNT">(
    needsFirstCount ? "SET_COUNT" : "ADD"
  );

  const qtyValid = quantity.trim() !== "" &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) >= (type === "SET_COUNT" ? 0 : 1);
  const qty = qtyValid ? Number(quantity) : 0;
  const physicalUnits = type === "SET_COUNT"
    ? Math.abs(qty - product.currentStock)
    : product.stockMode !== "VARIANT_STOCK"
      ? qty * Math.max(1, product.unitsPerSale)
      : qty;
  const value = type === "SET_COUNT"
    ? Math.max(0, qty) * product.unitCost
    : product.stockMode === "BUNDLE"
      ? qty * product.bundleUnitCost
      : physicalUnits * product.unitCost;
  const stockAfter = type === "SET_COUNT"
    ? qty
    : product.currentStock + (type === "ADD" ? physicalUnits : -physicalUnits);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success, state.message]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-900">{product.sku}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {product.stockMode === "BUNDLE"
                ? "VIRTUAL BUNDLE"
                : product.stockMode === "PARENT_STOCK"
                  ? "PARENT STOCK"
                  : "VARIATION STOCK"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">{product.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Parent: {product.parentSku} · {product.stockMode === "BUNDLE" ? "Possible sets" : product.stockVerified ? "Verified balance" : "Legacy/unverified balance"}:{" "}
            <strong>{product.currentStock}</strong> · Unit cost:{" "}
            <strong>{money(product.unitCost)}</strong>
            <span className={"ml-2 rounded-full px-2 py-1 font-semibold " +
              (product.stockVerified
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900")}>
              {product.stockVerified ? "Verified" : "Needs physical count"}
            </span>
          </p>
          {product.stockMode === "BUNDLE" ? (
            <p className="mt-2 text-xs font-medium text-violet-700">
              Components: {product.componentSummary}.
              This action changes every component. For only one damaged/missing colour, select its physical SKU instead.
            </p>
          ) : product.stockMode === "PARENT_STOCK" ? (
            <p className="mt-1 text-xs font-medium text-violet-700">
              1 × {product.sku} = {product.unitsPerSale} parent stock unit
              {product.unitsPerSale === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div
          className={
            "rounded-xl px-3 py-2 text-xs " +
            (type === "SET_COUNT"
              ? "bg-violet-50 text-violet-800"
              : type === "ADD"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700")
          }
        >
          {type === "SET_COUNT" ? (
            <>
              Confirm stored balance <strong>{product.currentStock}</strong> as{" "}
              <strong>{qtyValid ? qty : "—"}</strong> physical units.{" "}
              Valuation after verification: <strong>{qtyValid ? money(value) : "—"}</strong>.
            </>
          ) : (
            <>
              Preview: <strong>{type === "ADD" ? "+" : "-"}{physicalUnits}</strong>{" "}
              physical units · <strong>{money(value)}</strong> value · stock after{" "}
              <strong className={stockAfter < 0 ? "text-red-700" : ""}>
                {product.stockMode === "BUNDLE" ? "see individual component balances" : stockAfter}
              </strong>
            </>
          )}
        </div>
      </div>

      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_165px_140px_200px_1fr_auto]">
        <input type="hidden" name="productId" value={product.id} />

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Type</span>
          <select
            name="adjustmentType"
            value={type}
            onChange={(event) =>
              {
                const next = event.target.value === "SET_COUNT"
                  ? "SET_COUNT" : event.target.value === "REDUCE"
                    ? "REDUCE" : "ADD";
                setType(next);
                setQuantity(next === "SET_COUNT" ? "" : "1");
              }
            }
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          >
            <option value="ADD">Add Stock</option>
            <option value="REDUCE">Reduce Stock</option>
            {product.stockMode !== "BUNDLE" ? (
              <option value="SET_COUNT">Set Physical Count (verify inventory)</option>
            ) : null}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Date</span>
          <input
            type="date"
            name="adjustmentDate"
            defaultValue={today}
            required
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">
            {type === "SET_COUNT" ? "Actual physical count" : "Adjustment quantity"}
          </span>
          <input
            type="number"
            min={type === "SET_COUNT" ? 0 : 1}
            step={1}
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
            placeholder={type === "SET_COUNT" ? "Enter counted total (0 is valid)" : "Qty"}
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        {type === "SET_COUNT" ? (
          <input type="hidden" name="reason" value="Physical Count Verification" />
        ) : (
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Reason</span>
          <select
            name="reason"
            required
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          >
            <option value="">Select reason</option>
            <option value="Forgotten Count">Forgotten Count</option>
            <option value="Found Extra Stock">Found Extra Stock</option>
            <option value="Lost Product">Lost Product</option>
            <option value="Physical Count Correction">Physical Count Correction</option>
            <option value="Entry Mistake Correction">Entry Mistake Correction</option>
            <option value="Other">Other</option>
          </select>
        </label>
        )}

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Note</span>
          <input
            type="text"
            name="note"
            placeholder="Why is stock being adjusted?"
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={pending || !qtyValid}
          className={
            "self-end rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 " +
            (type === "SET_COUNT"
              ? "bg-violet-600 hover:bg-violet-700"
              : type === "ADD"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700")
          }
        >
          {pending
            ? "Saving..."
            : type === "SET_COUNT"
              ? "Verify Physical Count"
              : type === "ADD"
                ? "Add Stock"
                : "Reduce Stock"}
        </button>
      </form>

      {!product.stockVerified ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {product.stockMode === "BUNDLE"
            ? "This bundle has unverified components. Search for each physical component SKU and use Set Physical Count on those SKUs; a bundle has no count of its own."
            : "This is an unverified legacy balance. Use Set Physical Count to enter the exact quantity physically found (zero is allowed). Add/Reduce does not verify an old baseline or bring it into valuation."}
        </p>
      ) : null}

      {state.message ? (
        <div
          className={
            "mt-3 rounded-xl px-3 py-2 text-sm " +
            (state.warning
              ? "border border-amber-200 bg-amber-50 text-amber-800"
              : state.success
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700")
          }
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
