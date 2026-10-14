"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert, X } from "lucide-react";
import { trashStockOutOrders } from "../post-print-actions/actions";

export default function TrashStockOutButton({
  orderIds,
  invoiceCount,
}: {
  orderIds: string[];
  invoiceCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [message, setMessage] = useState("");

  function close() {
    if (pending) return;
    setStage(0);
    setMessage("");
  }

  function confirmTrash() {
    setMessage("");
    startTransition(async () => {
      const result = await trashStockOutOrders(orderIds);
      setMessage(result.message);

      if (result.success) {
        setStage(0);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending || orderIds.length === 0}
        onClick={() => setStage(1)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Trash All
      </button>

      {stage > 0 ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">
                    {stage === 1
                      ? "Trash all stock-out invoices?"
                      : "Final confirmation"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"} selected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {stage === 1 ? (
                <>
                  <p className="text-sm leading-6 text-slate-700">
                    These invoices will be moved from <strong>STOCK_OUT</strong> to{" "}
                    <strong>TRASH</strong> and removed from this Stock Out list.
                  </p>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Stock will <strong>not</strong> be restored.
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-900">
                    Confirm again: move all {invoiceCount} invoice
                    {invoiceCount === 1 ? "" : "s"} to Trash without restoring
                    any product stock.
                  </div>
                  <p className="text-xs text-slate-500">
                    This action is recorded in the order audit history.
                  </p>
                </>
              )}

              {message ? (
                <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {message}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              {stage === 1 ? (
                <button
                  type="button"
                  onClick={() => setStage(2)}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={confirmTrash}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {pending ? "Moving to Trash..." : "Yes, Trash All"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
