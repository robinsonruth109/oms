"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restoreStockOutOrder } from "../post-print-actions/actions";

export default function RestoreButton({
  orderIds,
  label = "Restore",
}: {
  orderIds: string[];
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending || orderIds.length === 0}
      onClick={() => {
        startTransition(async () => {
          for (const orderId of orderIds) {
            await restoreStockOutOrder(orderId);
          }
        });
      }}
    >
      {pending ? "Restoring..." : label}
    </Button>
  );
}