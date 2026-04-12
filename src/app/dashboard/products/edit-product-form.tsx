"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateProduct } from "./actions";

const initialState = {
  success: false,
  message: "",
};

type EditProductFormProps = {
  product: {
    id: string;
    sku: string;
    name: string;
    purchasePrice: string;
    sellingPrice: string;
    status: boolean;
    parent: {
      sku: string;
      name: string;
    };
  };
};

export default function EditProductForm({ product }: EditProductFormProps) {
  const [state, formAction, pending] = useActionState(updateProduct, initialState);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Edit Product</h2>
        <p className="mt-1 text-sm text-slate-500">
          Update product price, SKU, parent SKU, name or status.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="productId" value={product.id} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="parentSku" className="text-sm font-medium text-slate-700">
              Parent SKU
            </label>
            <input
              id="parentSku"
              name="parentSku"
              type="text"
              defaultValue={product.parent.sku}
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
              defaultValue={product.parent.name}
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
              defaultValue={product.sku}
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
              defaultValue={product.name}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
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
              step="0.01"
              min="0"
              defaultValue={product.purchasePrice}
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
              step="0.01"
              min="0"
              defaultValue={product.sellingPrice}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="status" className="text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={String(product.status)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
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
            {pending ? "Updating..." : "Update Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}