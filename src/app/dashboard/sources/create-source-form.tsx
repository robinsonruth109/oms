"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSource } from "./actions";

const initialState = {
  success: false,
  message: "",
};

export default function CreateSourceForm() {
  const [state, formAction, pending] = useActionState(createSource, initialState);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setResetKey((prev) => prev + 1);
    }
  }, [state.success]);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Create Source</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add a Shopify store, Laravel website, or manual source.
        </p>
      </div>

      <form key={resetKey} action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Source Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter source name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium text-slate-700">
              Source Type
            </label>
            <select
              id="type"
              name="type"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              required
              defaultValue="MANUAL"
            >
              <option value="MANUAL">MANUAL</option>
              <option value="SHOPIFY">SHOPIFY</option>
              <option value="LARAVEL">LARAVEL</option>
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
            {pending ? "Creating..." : "Create Source"}
          </Button>
        </div>
      </form>
    </div>
  );
}