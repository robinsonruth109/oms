"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProductDamageEntry,
  type DamageEntryActionState,
} from "./actions";

type Props = {
  product: {
    id: string;
    parentSku: string;
    sku: string;
    name: string;
    stockMode: "VARIANT_STOCK" | "PARENT_STOCK";
    currentStock: number;
    unitsPerSale: number;
    unitCost: number;
  };
  today: string;
};

const initialState: DamageEntryActionState = {
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

export default function DamageEntryForm({ product, today }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createProductDamageEntry,
    initialState
  );
  const [quantity, setQuantity] = useState("1");

  const qty = Math.max(0, Math.floor(Number(quantity || 0)));
  const physicalUnits =
    product.stockMode === "PARENT_STOCK"
      ? qty * Math.max(1, product.unitsPerSale)
      : qty;
  const damageValue = physicalUnits * product.unitCost;
  const stockAfter = product.currentStock - physicalUnits;

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success, state.message]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-900">{product.sku}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {product.stockMode === "PARENT_STOCK"
                ? "PARENT STOCK"
                : "VARIATION STOCK"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">{product.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Parent: {product.parentSku} · Current physical stock:{" "}
            <strong>{product.currentStock}</strong> · Unit cost:{" "}
            <strong>{money(product.unitCost)}</strong>
          </p>
          {product.stockMode === "PARENT_STOCK" ? (
            <p className="mt-1 text-xs font-medium text-violet-700">
              1 × {product.sku} = {product.unitsPerSale} parent stock unit
              {product.unitsPerSale === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Preview: <strong>{physicalUnits}</strong> physical unit
          {physicalUnits === 1 ? "" : "s"} ·{" "}
          <strong>{money(damageValue)}</strong> damage · stock after{" "}
          <strong className={stockAfter < 0 ? "text-red-600" : "text-slate-900"}>
            {stockAfter}
          </strong>
        </div>
      </div>

      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_150px_1fr_auto]">
        <input type="hidden" name="productId" value={product.id} />

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Damage Date</span>
          <input
            type="date"
            name="damageDate"
            defaultValue={today}
            required
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Damage Qty</span>
          <input
            type="number"
            min={1}
            step={1}
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Note</span>
          <input
            type="text"
            name="note"
            placeholder="Broken, damaged in office, packaging damage..."
            className="w-full rounded-xl border px-3 py-2.5 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={pending || qty < 1}
          className="self-end rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : "Add Damage"}
        </button>
      </form>

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
