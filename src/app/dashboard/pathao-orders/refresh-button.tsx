"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { refreshPathaoOrder } from "./actions";

const initialState = { success: false, message: "" };

export default function RefreshPathaoButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(refreshPathaoOrder, initialState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Refreshing..." : "Refresh Status"}
      </Button>
      {state.message ? (
        <p className={`max-w-xs text-xs ${state.success ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
