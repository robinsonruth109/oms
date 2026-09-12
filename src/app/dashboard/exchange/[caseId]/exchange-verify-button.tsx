"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { verifyExchangeCaseAction } from "../actions";

const initialState = { success: false, message: "" };

export default function ExchangeVerifyButton({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(
    verifyExchangeCaseAction,
    initialState
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="exchangeCaseId" value={caseId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Checking Pathao..." : "Verify Exchange CID"}
        </button>
      </form>
      {state.message ? (
        <p
          className={`max-w-xl text-xs ${
            state.success ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
