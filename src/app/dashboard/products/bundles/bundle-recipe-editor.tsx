"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { saveBundleRecipe } from "./bundle-actions";

type ComponentRow = { componentProductId: string; units: number };
type ComponentOption = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  cost: number;
};
type Product = {
  id: string;
  sku: string;
  name: string;
  parentSku: string;
  mode: string;
  kind: string;
  legacyQuantity: number;
  existing: ComponentRow[];
};

const initial = { success: false, message: "" };

export default function BundleRecipeEditor({
  product,
  options,
}: {
  product: Product;
  options: ComponentOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveBundleRecipe, initial);
  const [parts, setParts] = useState<ComponentRow[]>(
    product.existing.length
      ? product.existing
      : [{ componentProductId: "", units: 1 }]
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, state.message, router]);

  const estimatedCost = parts.reduce((sum, part) => {
    const component = options.find((option) => option.id === part.componentProductId);
    return sum + (component?.cost || 0) * Number(part.units || 0);
  }, 0);

  const availableSets = parts.length && parts.every((part) => part.componentProductId)
    ? Math.max(0, Math.min(...parts.map((part) => {
        const row = options.find((candidate) => candidate.id === part.componentProductId);
        return row && part.units > 0
          ? Math.floor(row.quantity / part.units)
          : 0;
      })))
    : 0;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{product.sku}</p>
          <p className="mt-1 text-sm text-slate-600">{product.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Parent: {product.parentSku} · {product.kind === "BUNDLE" ? "Virtual bundle" : "Physical SKU"}
          </p>
        </div>
        <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800">
          {availableSets} possible sets · cost ৳{estimatedCost.toFixed(2)} / set
        </div>
      </div>

      {product.mode !== "VARIANT_STOCK" ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Parent Stock cannot represent separate colour quantities. Use a Variation Stock parent for components.
        </p>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="recipeJson" value={JSON.stringify(parts)} />

          {parts.map((part, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_100px_auto] items-end gap-2">
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-600">Physical component {index + 1}</span>
                <select
                  value={part.componentProductId}
                  onChange={(event) =>
                    setParts((current) => current.map((row, i) =>
                      i === index ? { ...row, componentProductId: event.target.value } : row
                    ))
                  }
                  className="w-full rounded-xl border bg-white px-3 py-2"
                  required
                >
                  <option value="">Choose physical colour SKU</option>
                  {options.filter((option) => option.id !== product.id).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.sku} · stock {option.quantity}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-600">Units / set</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={part.units}
                  onChange={(event) =>
                    setParts((current) => current.map((row, i) =>
                      i === index ? { ...row, units: Number(event.target.value) } : row
                    ))
                  }
                  className="w-full rounded-xl border px-3 py-2"
                  required
                />
              </label>

              <button
                type="button"
                disabled={parts.length === 1}
                onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                className="rounded-xl border px-3 py-2 text-sm text-rose-600 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            disabled={parts.length >= 30}
            onClick={() => setParts((current) => [...current, { componentProductId: "", units: 1 }])}
            className="rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700"
          >
            + Add colour / component
          </button>

          {product.kind !== "BUNDLE" && product.legacyQuantity !== 0 ? (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <input type="checkbox" name="confirmLegacyStock" value="yes" required className="mt-0.5" />
              <span>
                Existing quantity {product.legacyQuantity} belongs to this selling SKU.
                I have checked physical colour counts. Converting to a virtual
                bundle preserves this old quantity in the database but removes it
                from valuation and available stock. It is NOT transferred to the
                components. I will reconcile physical colour quantities separately.
              </span>
            </label>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Only future orders use an edited recipe. Dispatched orders retain original stock snapshots.
            </p>
            <button
              type="submit"
              disabled={pending || parts.some((part) => !part.componentProductId || part.units < 1)}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Saving..." : "Save Bundle Recipe"}
            </button>
          </div>

          {state.message ? (
            <p className={
              "rounded-xl px-3 py-2 text-sm " +
              (state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")
            }>
              {state.message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
