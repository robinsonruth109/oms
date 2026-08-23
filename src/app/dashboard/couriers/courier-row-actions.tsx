"use client";

import { useState, useTransition } from "react";
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
  const [message, setMessage] = useState("");

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            try {
              await toggleCourierStatus(courierId, nextStatus);
            } catch {
              setMessage("Failed to update courier status.");
            }
          });
        }}
      >
        {pending ? "Updating..." : label}
      </Button>
      {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
    </div>
  );
}
