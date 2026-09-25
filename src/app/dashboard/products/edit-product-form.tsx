"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProduct } from "./actions";

const initialState = { success: false, message: "" };

type Props = {
  product: {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitsPerSale: number;
    purchasePrice: string;
    sellingPrice: string;
    status: boolean;
    parent: {
      sku: string;
      name: string;
      stockMode: "VARIANT_STOCK" | "PARENT_STOCK";
      stockQuantity: number;
      purchasePrice: string;
    };
  };
};

export default function EditProductForm({ product }: Props) {
  const [state, formAction, pending] = useActionState(updateProduct, initialState);
  const [stockMode, setStockMode] = useState(product.parent.stockMode);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Edit Product</h2>
        <p className="mt-1 text-sm text-slate-500">
          Stock Mode belongs to the parent. Changing it affects every child SKU under this parent.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="productId" value={product.id} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Parent SKU" name="parentSku" defaultValue={product.parent.sku} required />
          <TextField label="Parent Name" name="parentName" defaultValue={product.parent.name} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Stock Mode</span>
            <select
              name="stockMode"
              value={stockMode}
              onChange={(event) => setStockMode(event.target.value as "VARIANT_STOCK" | "PARENT_STOCK")}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="VARIANT_STOCK">Variation Stock</option>
              <option value="PARENT_STOCK">Parent Stock</option>
            </select>
          </label>

          {stockMode === "PARENT_STOCK" ? (
            <>
              <NumberField label="Parent Physical Stock" name="parentStockQuantity" min="0" defaultValue={String(product.parent.stockQuantity)} />
              <NumberField label="Parent Purchase Cost / Unit" name="parentPurchasePrice" min="0" step="0.01" defaultValue={product.parent.purchasePrice} />
            </>
          ) : (
            <>
              <input type="hidden" name="parentStockQuantity" value={String(product.parent.stockQuantity)} />
              <input type="hidden" name="parentPurchasePrice" value={product.parent.purchasePrice} />
            </>
          )}

          <TextField label="Child SKU" name="sku" defaultValue={product.sku} required />
          <TextField label="Product Name" name="name" defaultValue={product.name} required />
          <NumberField label="Units Used Per Sale" name="unitsPerSale" min="1" defaultValue={String(product.unitsPerSale)} />

          {stockMode === "VARIANT_STOCK" ? (
            <NumberField label="Child Stock Quantity" name="quantity" min="0" defaultValue={String(product.quantity)} />
          ) : (
            <input type="hidden" name="quantity" value={String(product.quantity)} />
          )}

          <NumberField label="Child Purchase Cost" name="purchasePrice" min="0" step="0.01" defaultValue={product.purchasePrice} />
          <NumberField label="Selling Price" name="sellingPrice" min="0" step="0.01" defaultValue={product.sellingPrice} />

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select name="status" defaultValue={String(product.status)} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        {state.message ? (
          <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Updating..." : "Update Product"}</Button>
        </div>
      </form>
    </div>
  );
}

function TextField({ label, name, defaultValue, required = false }: { label: string; name: string; defaultValue: string; required?: boolean }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type="text" defaultValue={defaultValue} required={required} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />
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
