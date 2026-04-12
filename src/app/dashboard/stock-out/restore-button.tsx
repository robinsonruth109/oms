"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restoreStockOutOrder } from "../post-print-actions/actions";

export default function RestoreButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await restoreStockOutOrder(orderId);
        });
      }}
    >
      {pending ? "Restoring..." : "Restore"}
    </Button>
  );
}