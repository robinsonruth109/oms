"use client";

import { useActionState, useEffect } from "react";
import { deleteOrderAction } from "./actions";

const initialState = {
  success: false,
  message: "",
};

export default function DeleteOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteOrderAction,
    initialState
  );

  useEffect(() => {
    if (state.message) {
      alert(state.message);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          "Are you sure you want to delete this order? This action cannot be undone."
        );

        if (!confirmed) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
    </form>
  );
}