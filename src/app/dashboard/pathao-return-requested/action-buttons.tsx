"use client";

import { useActionState } from "react";
import {
  markPathaoReattemptRequested,
  refreshReturnRequestedOrder,
  type ReturnRequestedActionState,
} from "./actions";

const initialState: ReturnRequestedActionState = {
  success: false,
  message: "",
};

export function RefreshReturnRequestedButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(
    refreshReturnRequestedOrder,
    initialState
  );

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Refreshing..." : "Refresh Status"}
      </button>
      {state.message ? (
        <p className={`text-[11px] ${state.success ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function MarkReattemptButton({
  orderId,
  alreadyMarked,
}: {
  orderId: string;
  alreadyMarked: boolean;
}) {
  const [state, action, pending] = useActionState(
    markPathaoReattemptRequested,
    initialState
  );

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending || alreadyMarked}
        className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:opacity-90"
      >
        {alreadyMarked
          ? "Reattempt Marked"
          : pending
            ? "Saving..."
            : "Mark Reattempt Done"}
      </button>
      {state.message ? (
        <p className={`text-[11px] ${state.success ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
