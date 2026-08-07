"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CourierProvider } from "@/lib/courier-score/types";

type Integration = {
  provider: CourierProvider;
  enabled: boolean;
  configured: boolean;
  usernameMasked: string | null;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string | null;
  updatedAt: string;
};

type FormState = {
  enabled: boolean;
  username: string;
  password: string;
  removeCredentials: boolean;
  showPassword: boolean;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  integrations?: Integration[];
  integration?: Integration;
};

const PROVIDERS: Array<{
  provider: CourierProvider;
  name: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  description: string;
}> = [
  {
    provider: "PATHAO",
    name: "Pathao",
    usernameLabel: "Merchant email / username",
    usernamePlaceholder: "merchant@example.com",
    description: "Pathao merchant login ব্যবহার করে customer delivery history check করবে।",
  },
  {
    provider: "STEADFAST",
    name: "Steadfast",
    usernameLabel: "Merchant email",
    usernamePlaceholder: "merchant@example.com",
    description: "Steadfast merchant session ব্যবহার করে fraud-check history read করবে।",
  },
  {
    provider: "REDX",
    name: "RedX",
    usernameLabel: "Merchant phone",
    usernamePlaceholder: "01XXXXXXXXX",
    description: "RedX merchant phone এবং password ব্যবহার করে delivery success data check করবে।",
  },
];

function emptyForm(enabled = false): FormState {
  return {
    enabled,
    username: "",
    password: "",
    removeCredentials: false,
    showPassword: false,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Never tested";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? "bg-orange-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
          checked ? "left-7" : "left-1"
        }`}
      />
    </button>
  );
}

export default function CourierIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [forms, setForms] = useState<Record<CourierProvider, FormState>>({
    PATHAO: emptyForm(),
    STEADFAST: emptyForm(),
    REDX: emptyForm(),
  });
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<CourierProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<CourierProvider | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const integrationMap = useMemo(
    () => new Map(integrations.map((item) => [item.provider, item])),
    [integrations]
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/courier-integrations", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const result = (await response.json()) as ApiResponse;

    if (!response.ok || !result.success || !result.integrations) {
      throw new Error(result.message || "Courier integrations লোড করা যায়নি।");
    }

    setIntegrations(result.integrations);
    setForms((current) => {
      const next = { ...current };
      for (const item of result.integrations ?? []) {
        next[item.provider] = emptyForm(item.enabled);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    load()
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Courier integrations লোড করা যায়নি।",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  function update(provider: CourierProvider, patch: Partial<FormState>) {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], ...patch },
    }));
    setMessage(null);
  }

  function applyIntegration(item: Integration) {
    setIntegrations((current) => {
      const exists = current.some((value) => value.provider === item.provider);
      return exists
        ? current.map((value) => (value.provider === item.provider ? item : value))
        : [...current, item];
    });

    setForms((current) => ({
      ...current,
      [item.provider]: emptyForm(item.enabled),
    }));
  }

  async function save(provider: CourierProvider) {
    const form = forms[provider];
    setSavingProvider(provider);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/courier-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          provider,
          enabled: form.enabled,
          username: form.username.trim(),
          password: form.password,
          removeCredentials: form.removeCredentials,
        }),
      });

      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success || !result.integration) {
        throw new Error(result.message || `${provider} settings save করা যায়নি।`);
      }

      applyIntegration(result.integration);
      setMessage({ type: "success", text: result.message || `${provider} settings saved.` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : `${provider} settings save করা যায়নি।`,
      });
    } finally {
      setSavingProvider(null);
    }
  }

  async function test(provider: CourierProvider) {
    const form = forms[provider];
    setTestingProvider(provider);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/courier-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "testConnection",
          provider,
          username: form.username.trim(),
          password: form.password,
        }),
      });

      const result = (await response.json()) as ApiResponse;
      if (result.integration) applyIntegration(result.integration);
      if (!response.ok || !result.success) {
        throw new Error(result.message || `${provider} connection failed.`);
      }

      setMessage({ type: "success", text: result.message || `${provider} connected.` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : `${provider} connection failed.`,
      });
    } finally {
      setTestingProvider(null);
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">📦 Courier Score Integrations</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Pathao, Steadfast এবং RedX merchant credentials securely save করুন। পরে Calling Panel customer courier score দেখাবে।
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {PROVIDERS.map((config) => {
          const integration = integrationMap.get(config.provider);
          const form = forms[config.provider];
          const busy = savingProvider === config.provider || testingProvider === config.provider;

          return (
            <article key={config.provider} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-950">{config.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        integration?.configured
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {integration?.configured ? "Credentials configured" : "Credentials missing"}
                    </span>
                    {integration?.lastTestSuccess === true && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">Connected</span>
                    )}
                    {integration?.lastTestSuccess === false && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">Test failed</span>
                    )}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">Enabled</span>
                  <Toggle
                    checked={form.enabled}
                    disabled={busy}
                    onChange={() => update(config.provider, { enabled: !form.enabled })}
                  />
                </div>
              </div>

              {integration?.usernameMasked && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  Saved account: <span className="font-mono font-semibold">{integration.usernameMasked}</span>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">{config.usernameLabel}</label>
                  <input
                    value={form.username}
                    onChange={(event) => update(config.provider, { username: event.target.value })}
                    placeholder={integration?.configured ? "Enter only to replace saved account" : config.usernamePlaceholder}
                    autoComplete="off"
                    disabled={busy || form.removeCredentials}
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-orange-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Password</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type={form.showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => update(config.provider, { password: event.target.value })}
                      placeholder={integration?.configured ? "Enter only to replace saved password" : "Courier password"}
                      autoComplete="new-password"
                      disabled={busy || form.removeCredentials}
                      className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-orange-500 disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => update(config.provider, { showPassword: !form.showPassword })}
                      disabled={busy}
                      className="rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
                    >
                      {form.showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              {integration?.configured && (
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-700">
                  <input
                    type="checkbox"
                    checked={form.removeCredentials}
                    onChange={(event) =>
                      update(config.provider, {
                        removeCredentials: event.target.checked,
                        enabled: event.target.checked ? false : form.enabled,
                        username: "",
                        password: "",
                      })
                    }
                    disabled={busy}
                  />
                  Remove saved {config.name} credentials
                </label>
              )}

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-slate-500">
                  <p>Last tested: {formatDate(integration?.lastTestedAt ?? null)}</p>
                  {integration?.lastTestMessage && <p className="mt-1">{integration.lastTestMessage}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void test(config.provider)}
                    disabled={busy || (!integration?.configured && (!form.username.trim() || !form.password))}
                    className="h-11 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-700 disabled:opacity-50"
                  >
                    {testingProvider === config.provider ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(config.provider)}
                    disabled={busy}
                    className="h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white disabled:bg-slate-400"
                  >
                    {savingProvider === config.provider ? "Saving..." : "Save Courier"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Credentials AES-256-GCM encryption দিয়ে database-এ save হবে। Courier login endpoints official public API নাও হতে পারে, তাই courier website change হলে connection adapter update প্রয়োজন হতে পারে।
        </p>
      </div>
    </section>
  );
}
