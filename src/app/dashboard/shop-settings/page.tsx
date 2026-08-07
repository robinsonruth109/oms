"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import CourierIntegrations from "./courier-integrations";

type ShopSetting = {
  id: string;
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  metaConversionsApiEnabled: boolean;
  metaTestEventCode: string | null;
  metaConversionsAccessTokenConfigured: boolean;
  metaConversionsAccessTokenMasked: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  field?: string;
  setting?: ShopSetting;
};

type FormState = {
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  metaPixelId: string;
  metaPixelEnabled: boolean;
  metaConversionsApiEnabled: boolean;
  metaTestEventCode: string;
  metaConversionsAccessToken: string;
  removeMetaConversionsAccessToken: boolean;
};

type FieldName =
  | "insideDhakaDeliveryCharge"
  | "outsideDhakaDeliveryCharge"
  | "metaPixelId"
  | "metaConversionsAccessToken";

type FieldErrors = Partial<Record<FieldName, string>>;

const DEFAULT_FORM: FormState = {
  insideDhakaDeliveryCharge: "70",
  outsideDhakaDeliveryCharge: "150",
  metaPixelId: "",
  metaPixelEnabled: false,
  metaConversionsApiEnabled: false,
  metaTestEventCode: "",
  metaConversionsAccessToken: "",
  removeMetaConversionsAccessToken: false,
};

const FIELD_NAMES: FieldName[] = [
  "insideDhakaDeliveryCharge",
  "outsideDhakaDeliveryCharge",
  "metaPixelId",
  "metaConversionsAccessToken",
];

function isFieldName(value: string | undefined): value is FieldName {
  return typeof value === "string" && FIELD_NAMES.includes(value as FieldName);
}

function formatDate(value: string | null) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadSettings() {
  const response = await fetch("/api/admin/shop-settings", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = (await response.json()) as ApiResponse;
  if (!response.ok || !result.success || !result.setting) {
    throw new Error(result.message || "Shop settings লোড করা যায়নি।");
  }
  return result.setting;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-60 ${
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

export default function DashboardShopSettingsPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(DEFAULT_FORM);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const applySetting = useCallback((setting: ShopSetting) => {
    const nextForm: FormState = {
      insideDhakaDeliveryCharge: setting.insideDhakaDeliveryCharge,
      outsideDhakaDeliveryCharge: setting.outsideDhakaDeliveryCharge,
      metaPixelId: setting.metaPixelId || "",
      metaPixelEnabled: setting.metaPixelEnabled,
      metaConversionsApiEnabled: setting.metaConversionsApiEnabled,
      metaTestEventCode: setting.metaTestEventCode || "",
      metaConversionsAccessToken: "",
      removeMetaConversionsAccessToken: false,
    };
    setForm(nextForm);
    setSavedForm(nextForm);
    setTokenConfigured(setting.metaConversionsAccessTokenConfigured);
    setMaskedToken(setting.metaConversionsAccessTokenMasked);
    setLastUpdatedAt(setting.updatedAt);
  }, []);

  function handleReset() {
    setForm({ ...savedForm });
    setFieldErrors({});
    setShowToken(false);
    setErrorMessage("");
    setSuccessMessage("Unsaved changes reset করা হয়েছে।");
  }

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((setting) => {
        if (!cancelled) applySetting(setting);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Shop settings লোড করা যায়নি।");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySetting]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      if (field in next) delete next[field as FieldName];
      return next;
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  function validate() {
    const errors: FieldErrors = {};
    const inside = Number(form.insideDhakaDeliveryCharge);
    const outside = Number(form.outsideDhakaDeliveryCharge);
    if (!Number.isFinite(inside) || inside < 0 || inside > 100000) {
      errors.insideDhakaDeliveryCharge = "Inside Dhaka delivery charge সঠিক নয়।";
    }
    if (!Number.isFinite(outside) || outside < 0 || outside > 100000) {
      errors.outsideDhakaDeliveryCharge = "Outside Dhaka delivery charge সঠিক নয়।";
    }
    if (form.metaPixelId && !/^\d{5,30}$/.test(form.metaPixelId)) {
      errors.metaPixelId = "Meta Pixel ID-তে শুধু সংখ্যা থাকতে পারবে।";
    }
    if ((form.metaPixelEnabled || form.metaConversionsApiEnabled) && !form.metaPixelId) {
      errors.metaPixelId = "Meta Pixel অথবা CAPI চালু করতে Pixel ID লিখুন।";
    }
    if (
      form.metaConversionsApiEnabled &&
      !form.metaConversionsAccessToken.trim() &&
      (!tokenConfigured || form.removeMetaConversionsAccessToken)
    ) {
      errors.metaConversionsAccessToken = "Conversions API চালু করতে Access Token লিখুন।";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");
    if (!validate()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/shop-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          insideDhakaDeliveryCharge: Number(form.insideDhakaDeliveryCharge),
          outsideDhakaDeliveryCharge: Number(form.outsideDhakaDeliveryCharge),
          metaPixelId: form.metaPixelId.trim(),
          metaPixelEnabled: form.metaPixelEnabled,
          metaConversionsApiEnabled: form.metaConversionsApiEnabled,
          metaTestEventCode: form.metaTestEventCode.trim(),
          metaConversionsAccessToken: form.metaConversionsAccessToken.trim(),
          removeMetaConversionsAccessToken: form.removeMetaConversionsAccessToken,
        }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success || !result.setting) {
        if (isFieldName(result.field)) {
          setFieldErrors((current) => ({ ...current, [result.field!]: result.message || "Invalid value" }));
        }
        throw new Error(result.message || "Shop settings সংরক্ষণ করা যায়নি।");
      }
      applySetting(result.setting);
      setSuccessMessage(result.message || "Shop settings সফলভাবে সংরক্ষণ করা হয়েছে।");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Shop settings সংরক্ষণ করা যায়নি।");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    setIsTesting(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin/shop-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testMetaConnection" }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Meta test event পাঠানো যায়নি।");
      }
      setSuccessMessage(result.message || "Meta test event সফলভাবে পাঠানো হয়েছে।");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Meta test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 p-8"><div className="mx-auto h-80 max-w-5xl animate-pulse rounded-2xl bg-slate-200" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Administration</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Shop Settings</h1>
            <p className="mt-2 text-sm text-slate-600">Delivery charge, Meta Pixel এবং Conversions API এখান থেকে নিয়ন্ত্রণ করুন।</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Last updated</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(lastUpdatedAt)}</p>
          </div>
        </header>

        {successMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{successMessage}</div>}
        {errorMessage && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errorMessage}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-950">🚚 Delivery Charge</h2>
              <p className="mt-1 text-sm text-slate-600">Checkout delivery charge নির্ধারণ করুন।</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              {([
                ["insideDhakaDeliveryCharge", "Inside Dhaka"],
                ["outsideDhakaDeliveryCharge", "Outside Dhaka"],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label htmlFor={field} className="text-sm font-semibold text-slate-800">{label}</label>
                  <div className="relative mt-2">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-slate-500">৳</span>
                    <input
                      id={field}
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      value={form[field]}
                      onChange={(event) => update(field, event.target.value)}
                      disabled={isSaving}
                      className={`h-12 w-full rounded-xl border bg-white pl-10 pr-4 font-semibold outline-none ${fieldErrors[field] ? "border-red-400" : "border-slate-300 focus:border-orange-500"}`}
                    />
                  </div>
                  {fieldErrors[field] && <p className="mt-2 text-sm text-red-600">{fieldErrors[field]}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-950">📊 Meta Pixel & Conversions API</h2>
              <p className="mt-1 text-sm text-slate-600">Browser এবং server-side purchase tracking configure করুন।</p>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div><p className="font-semibold text-slate-900">Enable Meta Pixel</p><p className="mt-1 text-sm text-slate-600">Browser events পাঠাবে।</p></div>
                <Toggle checked={form.metaPixelEnabled} onChange={() => update("metaPixelEnabled", !form.metaPixelEnabled)} disabled={isSaving} />
              </div>

              <div>
                <label htmlFor="metaPixelId" className="text-sm font-semibold text-slate-800">Meta Pixel ID</label>
                <input
                  id="metaPixelId"
                  value={form.metaPixelId}
                  onChange={(event) => update("metaPixelId", event.target.value.replace(/\D/g, ""))}
                  placeholder="Example: 123456789012345"
                  maxLength={30}
                  disabled={isSaving}
                  className={`mt-2 h-12 w-full rounded-xl border px-4 outline-none ${fieldErrors.metaPixelId ? "border-red-400" : "border-slate-300 focus:border-orange-500"}`}
                />
                {fieldErrors.metaPixelId && <p className="mt-2 text-sm text-red-600">{fieldErrors.metaPixelId}</p>}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div><p className="font-semibold text-slate-900">Enable Conversions API</p><p className="mt-1 text-sm text-slate-600">Purchase event server থেকে Meta-তে পাঠাবে।</p></div>
                <Toggle checked={form.metaConversionsApiEnabled} onChange={() => update("metaConversionsApiEnabled", !form.metaConversionsApiEnabled)} disabled={isSaving} />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="metaConversionsAccessToken" className="text-sm font-semibold text-slate-800">Conversions API Access Token</label>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tokenConfigured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {tokenConfigured ? "Token configured" : "Token missing"}
                  </span>
                </div>
                {maskedToken && <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-700">Saved: {maskedToken}</p>}
                <div className="mt-2 flex gap-2">
                  <input
                    id="metaConversionsAccessToken"
                    type={showToken ? "text" : "password"}
                    value={form.metaConversionsAccessToken}
                    onChange={(event) => update("metaConversionsAccessToken", event.target.value)}
                    placeholder={tokenConfigured ? "Enter a new token only to replace the saved token" : "Paste Meta access token"}
                    autoComplete="new-password"
                    disabled={isSaving || form.removeMetaConversionsAccessToken}
                    className={`h-12 min-w-0 flex-1 rounded-xl border px-4 outline-none ${fieldErrors.metaConversionsAccessToken ? "border-red-400" : "border-slate-300 focus:border-orange-500"}`}
                  />
                  <button type="button" onClick={() => setShowToken((value) => !value)} className="rounded-xl border border-slate-300 px-4 text-sm font-semibold">{showToken ? "Hide" : "Show"}</button>
                </div>
                {fieldErrors.metaConversionsAccessToken && <p className="mt-2 text-sm text-red-600">{fieldErrors.metaConversionsAccessToken}</p>}
                {tokenConfigured && (
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-red-700">
                    <input
                      type="checkbox"
                      checked={form.removeMetaConversionsAccessToken}
                      onChange={(event) => update("removeMetaConversionsAccessToken", event.target.checked)}
                    />
                    Remove saved access token when settings are saved
                  </label>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-500">Token database-এ AES-256-GCM encryption ব্যবহার করে সংরক্ষণ হবে এবং browser-এ পূর্ণ token আর ফেরত আসবে না।</p>
              </div>

              <div>
                <label htmlFor="metaTestEventCode" className="text-sm font-semibold text-slate-800">Test Event Code (optional)</label>
                <input
                  id="metaTestEventCode"
                  value={form.metaTestEventCode}
                  onChange={(event) => update("metaTestEventCode", event.target.value)}
                  placeholder="Example: TEST12345"
                  disabled={isSaving}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-orange-500"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">Meta Events Manager → Test events থেকে code নিয়ে এখানে দিন। Code থাকলে Test Meta Connection একটি আসল server-side PageView test event পাঠাবে। Testing শেষ হলে code খালি করুন।</p>
              </div>

              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={isTesting || isSaving || !tokenConfigured}
                className="h-11 rounded-xl border border-blue-300 bg-blue-50 px-5 text-sm font-bold text-blue-700 disabled:opacity-50"
              >
                {isTesting ? "Sending test event..." : "Send Meta Test Event"}
              </button>
            </div>
          </section>

          <CourierIntegrations />

          <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">Token save করার আগে server-এ SHOP_SETTINGS_ENCRYPTION_KEY configure করতে হবে।</p>
              <div className="flex gap-3">
                <button type="button" onClick={handleReset} disabled={isSaving || isTesting} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold disabled:opacity-50">Reset</button>
                <button type="submit" disabled={isSaving} className="h-11 min-w-36 rounded-xl bg-orange-600 px-6 text-sm font-bold text-white disabled:bg-slate-400">
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
