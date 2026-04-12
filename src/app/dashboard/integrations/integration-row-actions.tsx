"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  regenerateIntegrationApiKey,
  toggleIntegrationStatus,
} from "./actions";

export function ToggleIntegrationButton({
  integrationId,
  nextStatus,
  label,
}: {
  integrationId: string;
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
          await toggleIntegrationStatus(integrationId, nextStatus);
        });
      }}
    >
      {pending ? "Updating..." : label}
    </Button>
  );
}

export function RegenerateApiKeyButton({
  integrationId,
}: {
  integrationId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "Are you sure you want to regenerate this API key? Existing store connections will stop working until updated."
        );

        if (!confirmed) return;

        startTransition(async () => {
          await regenerateIntegrationApiKey(integrationId);
        });
      }}
    >
      {pending ? "Regenerating..." : "Regenerate API Key"}
    </Button>
  );
}

export function SecretField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const maskedValue = useMemo(() => {
    if (show) return value;
    if (value.length <= 10) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }, [show, value]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(`Could not copy ${label.toLowerCase()}. Please copy manually.`);
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-800 break-all">
        {maskedValue}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShow((prev) => !prev)}
        >
          {show ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              View
            </>
          )}
        </Button>

        <Button type="button" variant="outline" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied" : `Copy ${label}`}
        </Button>
      </div>
    </div>
  );
}

export function CopyTextButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(`Could not copy ${label.toLowerCase()}. Please copy manually.`);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleCopy}>
      <Copy className="mr-2 h-4 w-4" />
      {copied ? "Copied" : `Copy ${label}`}
    </Button>
  );
}