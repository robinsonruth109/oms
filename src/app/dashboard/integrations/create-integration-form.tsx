"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createIntegration } from "./actions";

const initialState = {
  success: false,
  message: "",
};

type SourceOption = {
  id: string;
  name: string;
  type: string;
};

export default function CreateIntegrationForm({
  sources,
  embedded = false,
}: {
  sources: SourceOption[];
  embedded?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createIntegration, initialState);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setResetKey((prev) => prev + 1);
    }
  }, [state.success]);

  return (
    <form
      key={resetKey}
      action={formAction}
      className={
        embedded
          ? "space-y-4 rounded-2xl border bg-white p-4 sm:p-5"
          : "space-y-4 rounded-3xl border bg-white p-5 shadow-sm sm:p-6"
      }
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Create Integration
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Add a website connection. Store engine and catalog URL style are configured separately.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Integration Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Example: Shopify Glowss"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="text-sm font-medium text-slate-700">
            Integration Slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            placeholder="Example: shopify-glowss"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          />
          <p className="text-xs text-slate-500">
            This becomes the endpoint path.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="platform" className="text-sm font-medium text-slate-700">
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue=""
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          >
            <option value="" disabled>
              Select website engine
            </option>
            <option value="LARAVEL">LARAVEL</option>
            <option value="SHOPIFY">SHOPIFY</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="sourceId" className="text-sm font-medium text-slate-700">
            Source
          </label>
          <select
            id="sourceId"
            name="sourceId"
            defaultValue=""
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            required
          >
            <option value="" disabled>
              Select source
            </option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} ({source.type})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="catalogMode" className="text-sm font-medium text-slate-700">
            Catalog Structure
          </label>
          <select
            id="catalogMode"
            name="catalogMode"
            defaultValue="SUBCATEGORY"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          >
            <option value="SUBCATEGORY">Subcategory — /subcategory/&#123;slug&#125;</option>
            <option value="COLLECTION">Collection — /collections/&#123;slug&#125;</option>
          </select>
          <p className="text-xs text-slate-500">
            Laravel websites may use either style. This does not change the website engine.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="baseUrl" className="text-sm font-medium text-slate-700">
            Website Base URL
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="url"
            placeholder="https://shop.example.com"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="catalogApiToken" className="text-sm font-medium text-slate-700">
            Laravel Catalog API Token
          </label>
          <input
            id="catalogApiToken"
            name="catalogApiToken"
            type="password"
            placeholder="Token generated on the Laravel website"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-500">
            OMS uses this token when calling /api/oms/v1 on the website. It is separate from the OMS order API key above.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 p-3 md:col-span-2">
          <input
            type="checkbox"
            name="productSyncEnabled"
            value="true"
            className="mt-1"
          />
          <span className="text-sm text-slate-700">
            Enable Product Sync immediately. Base URL and Catalog API Token are required.
          </span>
        </label>

        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor="webhookSecret"
            className="text-sm font-medium text-slate-700"
          >
            Webhook Secret (Optional)
          </label>
          <input
            id="webhookSecret"
            name="webhookSecret"
            type="text"
            placeholder="Optional extra secret for webhook verification"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>
      </div>

      {state.message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            state.success
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Integration"}
        </Button>
      </div>
    </form>
  );
}