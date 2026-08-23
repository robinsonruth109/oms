"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  testCourierPathao,
  updateCourierPathao,
} from "./actions";

const initialState = { success: false, message: "" };

type Props = {
  courier: {
    id: string;
    name: string;
    slug: string;
    status: boolean;
    pathaoEnabled: boolean;
    pathaoEnvironment: "SANDBOX" | "LIVE";
    pathaoStoreId: number | null;
    pathaoStoreName: string | null;
    pathaoStoreAddress: string | null;
    pathaoLastTestedAt: string | null;
    pathaoLastTestSuccess: boolean | null;
    pathaoLastTestMessage: string | null;
    credentialsConfigured: boolean;
    webhookConfigured: boolean;
    callbackUrl: string;
  };
};

export default function PathaoCourierCard({ courier }: Props) {
  const [saveState, saveAction, savePending] = useActionState(
    updateCourierPathao,
    initialState
  );
  const [testState, testAction, testPending] = useActionState(
    testCourierPathao,
    initialState
  );

  const message = saveState.message || testState.message;
  const success = saveState.success || testState.success;

  return (
    <div className="rounded-3xl border bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{courier.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${courier.status ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {courier.status ? "Active" : "Inactive"}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${courier.pathaoEnabled ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
              {courier.pathaoEnabled ? "Pathao Enabled" : "Pathao Disabled"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Slug: {courier.slug}</p>
          <p className="mt-1 text-sm text-slate-500">
            Store: {courier.pathaoStoreName || "Not selected"}
            {courier.pathaoStoreId ? ` (ID ${courier.pathaoStoreId})` : ""}
          </p>
          {courier.pathaoStoreAddress ? (
            <p className="mt-1 text-sm text-slate-500">{courier.pathaoStoreAddress}</p>
          ) : null}
        </div>

        <div className="text-right text-xs text-slate-500">
          <p>
            Credentials: {courier.credentialsConfigured ? "Configured" : "Missing"}
          </p>
          <p>
            Webhook: {courier.webhookConfigured ? "Configured" : "Missing"}
          </p>
          <p>
            Last test: {courier.pathaoLastTestedAt || "Never"}
          </p>
        </div>
      </div>

      {message ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      ) : null}

      {courier.pathaoLastTestMessage ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${courier.pathaoLastTestSuccess ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {courier.pathaoLastTestMessage}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border bg-white p-4 text-sm">
        <p className="font-medium text-slate-800">Pathao Webhook Callback URL</p>
        <code className="mt-2 block break-all rounded-xl bg-slate-900 p-3 text-xs text-white">
          {courier.callbackUrl}
        </code>
        <p className="mt-2 text-xs text-slate-500">
          Add this URL in Pathao Merchant webhook settings. Use the same Webhook Secret saved below.
        </p>
      </div>

      <form action={saveAction} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <input type="hidden" name="courierId" value={courier.id} />

        <label className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm">
          <input type="checkbox" name="pathaoEnabled" defaultChecked={courier.pathaoEnabled} />
          <span className="font-medium">Pathao Enabled</span>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Environment</span>
          <select name="pathaoEnvironment" defaultValue={courier.pathaoEnvironment} className="w-full rounded-xl border bg-white px-3 py-2.5">
            <option value="LIVE">Production / Live</option>
            <option value="SANDBOX">Sandbox / Test</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Store ID</span>
          <input name="storeId" defaultValue={courier.pathaoStoreId || ""} className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder="Auto-select when testing" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Client ID</span>
          <input name="clientId" className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder={courier.credentialsConfigured ? "Leave blank to keep saved value" : "Required"} />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Client Secret</span>
          <input name="clientSecret" type="password" className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder={courier.credentialsConfigured ? "Leave blank to keep saved value" : "Required"} />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Merchant Username / Email</span>
          <input name="username" className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder={courier.credentialsConfigured ? "Leave blank to keep saved value" : "Required"} />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Merchant Password</span>
          <input name="password" type="password" className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder={courier.credentialsConfigured ? "Leave blank to keep saved value" : "Required"} />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Webhook Secret</span>
          <input name="webhookSecret" type="password" className="w-full rounded-xl border bg-white px-3 py-2.5" placeholder={courier.webhookConfigured ? "Leave blank to keep saved secret" : "Required"} />
        </label>

        <div className="flex items-end">
          <Button type="submit" disabled={savePending}>
            {savePending ? "Saving..." : "Save Pathao Settings"}
          </Button>
        </div>
      </form>

      <form action={testAction} className="mt-4">
        <input type="hidden" name="courierId" value={courier.id} />
        <Button type="submit" variant="outline" disabled={testPending}>
          {testPending ? "Testing..." : "Test Connection + Sync Store"}
        </Button>
      </form>
    </div>
  );
}
