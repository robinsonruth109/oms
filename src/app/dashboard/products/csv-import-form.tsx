"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { importProductsCsv } from "./actions";

const initialState = {
  success: false,
  message: "",
};

export default function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importProductsCsv, initialState);
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
          Bulk CSV Import
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV file. The importer supports header-based mapping. Minimum
          needed columns are SKU, Purchase, Sell, and Parent SKU. If a parent
          SKU is missing, it will be created automatically.
        </p>
      </div>

      <form key={resetKey} action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="file" className="text-sm font-medium text-slate-700">
            CSV File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          />
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
            {pending ? "Importing..." : "Import CSV"}
          </Button>
        </div>
      </form>
    </div>
  );
}