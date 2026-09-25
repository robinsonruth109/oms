"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateUserRole } from "./actions";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "ADMIN" },
  { value: "MANAGER", label: "MANAGER" },
  { value: "AGENT", label: "AGENT" },
  { value: "NOTE_AGENT", label: "NOTE AGENT" },
  { value: "PACKAGING_AGENT", label: "PACKAGING AGENT" },
] as const;

export default function ChangeUserRole({
  userId,
  userName,
  currentRole,
  disabled = false,
}: {
  userId: string;
  userName: string;
  currentRole: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveRole() {
    setMessage("");
    startTransition(async () => {
      const result = await updateUserRole(userId, role);
      setSuccess(result.success);
      setMessage(result.message);
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={disabled || pending}
          aria-label={`Change ${userName} role`}
          className="min-w-[150px] rounded-lg border bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={saveRole}
          disabled={disabled || pending || role === currentRole}
          className="rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Change Role"}
        </button>
      </div>

      {message ? (
        <p className={`mt-1.5 text-xs ${success ? "text-emerald-600" : "text-red-600"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
