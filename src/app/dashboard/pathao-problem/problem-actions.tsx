"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  authorizePathaoCod,
  clearPathaoCodAuthorization,
  refreshPathaoProblemOrder,
  type PathaoProblemActionState,
} from "./actions";

const initialState: PathaoProblemActionState = {
  success: false,
  message: "",
};

export function RefreshPathaoProblemButton({
  orderId,
}: {
  orderId: string;
}) {
  const [state, action, pending] = useActionState(
    refreshPathaoProblemOrder,
    initialState
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Refreshing..." : "Refresh Pathao Amount"}
      </Button>
      {state.message ? (
        <p
          className={`max-w-md text-xs ${
            state.success ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CodAuthorizationForm({
  orderId,
  currentAmount,
}: {
  orderId: string;
  currentAmount: number;
}) {
  const [state, action, pending] = useActionState(
    authorizePathaoCod,
    initialState
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <label className="block space-y-2 text-sm">
        <span className="font-medium text-slate-700">
          Authorized Pathao COD Amount
        </span>
        <input
          name="authorizedAmount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={currentAmount}
          className="w-full rounded-xl border px-3 py-2.5"
          required
        />
      </label>

      <label className="block space-y-2 text-sm">
        <span className="font-medium text-slate-700">
          Authorization Reason / Note
        </span>
        <textarea
          name="reason"
          rows={3}
          className="w-full rounded-xl border px-3 py-2.5"
          placeholder="Example: Delivery agent called; customer agreed to pay ৳950."
          required
        />
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Authorize COD Amount"}
      </Button>

      {state.message ? (
        <p
          className={`text-sm ${
            state.success ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ClearCodAuthorizationButton({
  orderId,
}: {
  orderId: string;
}) {
  const [state, action, pending] = useActionState(
    clearPathaoCodAuthorization,
    initialState
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Clearing..." : "Clear Current Authorization"}
      </Button>
      {state.message ? (
        <p
          className={`max-w-md text-xs ${
            state.success ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
