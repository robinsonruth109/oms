"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteUser } from "./actions";

export default function DeleteUserButton({
  userId,
  userName,
  disabled = false,
}: {
  userId: string;
  userName: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDelete() {
    if (disabled || isPending) return;

    const confirmed = window.confirm(
      `Delete ${userName}?\n\nThis permanently removes the user account. This action cannot be undone.`
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await deleteUser(userId);

      if (!result.success) {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isPending}
        onClick={handleDelete}
        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {isPending ? "Deleting..." : "Delete"}
      </Button>

      {message ? (
        <p className="max-w-56 text-xs font-medium text-red-600">{message}</p>
      ) : null}
    </div>
  );
}
