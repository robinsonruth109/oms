"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleCourierStatus } from "./actions";

export default function CourierStatusButton({
  courierId,
  nextStatus,
  label,
}: {
  courierId: string;
  nextStatus: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleCourierStatus(courierId, nextStatus);
        });
      }}
    >
      {pending ? "Updating..." : label}
    </Button>
  );
}