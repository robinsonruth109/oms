"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createProduct } from "./actions";

const initialState = { success: false, message: "" };

export default function CreateProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const [resetKey, setResetKey] = useState(0);
  const [stockMode, setStockMode] = useState<"VARIANT_STOCK" | "PARENT_STOCK">("VARIANT_STOCK");

  useEffect(() => {
    if (state.success) {
      setResetKey((prev) => prev + 1);
      setStockMode("VARIANT_STOCK");
    }
  }, [state.success]);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Manual Product Entry</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose whether inventory belongs to each child SKU or is shared by the parent product.
        </p>
      </div>

      <form key={resetKey} action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Parent SKU" name="parentSku" required placeholder="A" />
          <Field label="Parent Name" name="parentName" placeholder="Optional parent name" />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Stock Mode</span>
            <select
              name="stockMode"
              value={stockMode}
              onChange={(event) => setStockMode(event.target.value as "VARIANT_STOCK" | "PARENT_STOCK")}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="VARIANT_STOCK">Variation Stock — each child keeps its own stock</option>
              <option value="PARENT_STOCK">Parent Stock — all children consume shared parent units</option>
            </select>
          </label>

          {stockMode === "PARENT_STOCK" ? (
            <>
              <NumberField label="Parent Physical Stock" name="parentStockQuantity" min="0" defaultValue="0" />
              <NumberField label="Parent Purchase Cost / Unit" name="parentPurchasePrice" min="0" step="0.01" defaultValue="0" />
            </>
          ) : (
            <>
              <input type="hidden" name="parentStockQuantity" value="0" />
              <input type="hidden" name="parentPurchasePrice" value="0" />
            </>
          )}

          <Field label="Child SKU" name="sku" required placeholder="A-1" />
          <Field label="Product Name" name="name" placeholder="Optional, defaults to SKU" />

          <NumberField
            label={stockMode === "PARENT_STOCK" ? "Units Used Per Sale" : "Units Per Sale"}
            name="unitsPerSale"
            min="1"
            defaultValue="1"
          />

          {stockMode === "VARIANT_STOCK" ? (
            <NumberField label="Child Stock Quantity" name="quantity" min="0" defaultValue="0" />
          ) : (
            <input type="hidden" name="quantity" value="0" />
          )}

          <NumberField
            label={stockMode === "VARIANT_STOCK" ? "Child Purchase Cost" : "Child Purchase Cost (reference)"}
            name="purchasePrice"
            min="0"
            step="0.01"
            defaultValue="0"
          />
          <NumberField label="Selling Price" name="sellingPrice" min="0" step="0.01" defaultValue="0" />
        </div>

        {stockMode === "PARENT_STOCK" ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Example: A-3 with Units Used Per Sale = 5 deducts 5 physical units from parent A after successful CSV/courier submission.
          </div>
        ) : null}

        {state.message ? (
          <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create Product"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type="text" placeholder={placeholder} required={required} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />
    </label>
  );
}

function NumberField({ label, name, min, step, defaultValue }: { label: string; name: string; min: string; step?: string; defaultValue: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type="number" min={min} step={step || "1"} defaultValue={defaultValue} required className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />
    </label>
  );
}
