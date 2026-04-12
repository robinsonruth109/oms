"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createProduct } from "./actions";

const initialState = {
  success: false,
  message: "",
};

export default function CreateProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setResetKey((prev) => prev + 1);
    }
  }, [state.success]);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Manual Product Entry
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Search or type an existing parent SKU. If it does not exist, the
          system will create the parent automatically, then create the SKU under
          it.
        </p>
      </div>

      <form key={resetKey} action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="parentSku" className="text-sm font-medium text-slate-700">
              Parent SKU
            </label>
            <input
              id="parentSku"
              name="parentSku"
              type="text"
              placeholder="Search or type parent SKU"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="parentName" className="text-sm font-medium text-slate-700">
              Parent Name
            </label>
            <input
              id="parentName"
              name="parentName"
              type="text"
              placeholder="Optional for new parent"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="sku" className="text-sm font-medium text-slate-700">
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              placeholder="Enter child SKU"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Product Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Optional, defaults to SKU"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="purchasePrice"
              className="text-sm font-medium text-slate-700"
            >
              Purchase Price
            </label>
            <input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="sellingPrice"
              className="text-sm font-medium text-slate-700"
            >
              Selling Price
            </label>
            <input
              id="sellingPrice"
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>
        </div>

        {state.message ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              state.success
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}