"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  bulkCsvCancelled,
  bulkCsvStockOut,
  markSingleInvoiceCancelled,
  markSingleInvoiceStockOut,
} from "./actions";

const initialState = {
  success: false,
  message: "",
};

export function SingleStockOutForm() {
  const [state, action, pending] = useActionState(markSingleInvoiceStockOut, initialState);

  return (
    <form action={action} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Single Stock Out</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter one invoice number like GL2536 to mark stock out.
        </p>
      </div>

      <input
        name="invoiceId"
        type="text"
        placeholder="Enter invoice ID"
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        required
      />

      {state.message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Mark Stock Out"}
      </Button>
    </form>
  );
}

export function SingleCancelForm() {
  const [state, action, pending] = useActionState(markSingleInvoiceCancelled, initialState);

  return (
    <form action={action} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Single Cancel</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter one invoice number like GL2536 to mark cancelled.
        </p>
      </div>

      <input
        name="invoiceId"
        type="text"
        placeholder="Enter invoice ID"
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        required
      />

      {state.message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Mark Cancelled"}
      </Button>
    </form>
  );
}

export function BulkStockOutCsvForm() {
  const [state, action, pending] = useActionState(bulkCsvStockOut, initialState);

  return (
    <form action={action} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bulk Stock Out CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload CSV where column 1 contains invoice numbers.
        </p>
      </div>

      <input
        name="file"
        type="file"
        accept=".csv"
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        required
      />

      {state.message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading..." : "Upload Stock Out CSV"}
      </Button>
    </form>
  );
}

export function BulkCancelCsvForm() {
  const [state, action, pending] = useActionState(bulkCsvCancelled, initialState);

  return (
    <form action={action} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bulk Cancel CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload CSV where column 1 contains invoice numbers.
        </p>
      </div>

      <input
        name="file"
        type="file"
        accept=".csv"
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        required
      />

      {state.message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading..." : "Upload Cancel CSV"}
      </Button>
    </form>
  );
}