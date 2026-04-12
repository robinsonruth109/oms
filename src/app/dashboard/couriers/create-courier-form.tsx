"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createCourier } from "./actions";

const initialState = {
  success: false,
  message: "",
};

export default function CreateCourierForm() {
  const [state, formAction, pending] = useActionState(
    createCourier,
    initialState
  );
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setResetKey((prev) => prev + 1);
    }
  }, [state.success]);

  return (
    <form
      key={resetKey}
      action={formAction}
      className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Create Courier
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Add dynamic courier options for calling panel, ready-to-ship and manual orders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Courier Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Example: Trendy Shop-Pathao"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="text-sm font-medium text-slate-700">
            Courier Slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            placeholder="Example: trendy-shop-pathao"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-xs text-slate-500">
            Optional. If empty, slug will be generated from name.
          </p>
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
          {pending ? "Creating..." : "Create Courier"}
        </Button>
      </div>
    </form>
  );
}