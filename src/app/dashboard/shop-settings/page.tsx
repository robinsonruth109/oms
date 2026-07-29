"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ShopSetting = {
  id: string;
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShopSettingResponse = {
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
};

type FieldName =
  | "insideDhakaDeliveryCharge"
  | "outsideDhakaDeliveryCharge"
  | "metaPixelId"
  | "metaPixelEnabled";

type FieldErrors = Partial<Record<FieldName, string>>;

const DEFAULT_FORM_STATE: FormState = {
  insideDhakaDeliveryCharge: "70",
  outsideDhakaDeliveryCharge: "150",
  metaPixelId: "",
  metaPixelEnabled: false,
};

const VALID_FIELD_NAMES: FieldName[] = [
  "insideDhakaDeliveryCharge",
  "outsideDhakaDeliveryCharge",
  "metaPixelId",
  "metaPixelEnabled",
];

function isFieldName(value: string | undefined): value is FieldName {
  return (
    typeof value === "string" &&
    VALID_FIELD_NAMES.includes(value as FieldName)
  );
}

function formatMoney(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

async function fetchShopSettings(): Promise<ShopSetting> {
  const response = await fetch("/api/admin/shop-settings", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const result = (await response.json()) as ShopSettingResponse;

  if (!response.ok || !result.success || !result.setting) {
    throw new Error(result.message || "Shop settings লোড করা যায়নি।");
  }

  return result.setting;
}

export default function DashboardShopSettingsPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const applySettingToForm = useCallback((setting: ShopSetting) => {
    setForm({
      insideDhakaDeliveryCharge:
        setting.insideDhakaDeliveryCharge,
      outsideDhakaDeliveryCharge:
        setting.outsideDhakaDeliveryCharge,
      metaPixelId: setting.metaPixelId || "",
      metaPixelEnabled: setting.metaPixelEnabled,
    });

    setLastUpdatedAt(setting.updatedAt);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    fetchShopSettings()
      .then((setting) => {
        if (isCancelled) {
          return;
        }

        applySettingToForm(setting);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Shop settings লোড করা যায়নি।"
        );
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [applySettingToForm]);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    setFieldErrors({});

    try {
      const setting = await fetchShopSettings();
      applySettingToForm(setting);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Shop settings লোড করা যায়নি।"
      );
    } finally {
      setIsLoading(false);
    }
  }, [applySettingToForm]);

  function updateForm<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });

    setSuccessMessage("");
    setErrorMessage("");
  }

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    const insideCharge = Number(form.insideDhakaDeliveryCharge);
    const outsideCharge = Number(form.outsideDhakaDeliveryCharge);

    if (
      form.insideDhakaDeliveryCharge.trim() === "" ||
      !Number.isFinite(insideCharge)
    ) {
      errors.insideDhakaDeliveryCharge =
        "Inside Dhaka delivery charge লিখুন।";
    } else if (insideCharge < 0) {
      errors.insideDhakaDeliveryCharge =
        "Delivery charge ঋণাত্মক হতে পারবে না।";
    } else if (insideCharge > 100000) {
      errors.insideDhakaDeliveryCharge =
        "Delivery charge অনেক বেশি হয়েছে।";
    }

    if (
      form.outsideDhakaDeliveryCharge.trim() === "" ||
      !Number.isFinite(outsideCharge)
    ) {
      errors.outsideDhakaDeliveryCharge =
        "Outside Dhaka delivery charge লিখুন।";
    } else if (outsideCharge < 0) {
      errors.outsideDhakaDeliveryCharge =
        "Delivery charge ঋণাত্মক হতে পারবে না।";
    } else if (outsideCharge > 100000) {
      errors.outsideDhakaDeliveryCharge =
        "Delivery charge অনেক বেশি হয়েছে।";
    }

    const normalizedPixelId = form.metaPixelId.trim();

    if (
      normalizedPixelId &&
      !/^\d{5,30}$/.test(normalizedPixelId)
    ) {
      errors.metaPixelId =
        "Meta Pixel ID-তে শুধু সংখ্যা থাকতে পারবে।";
    }

    if (form.metaPixelEnabled && !normalizedPixelId) {
      errors.metaPixelId =
        "Meta Pixel চালু করতে Pixel ID লিখুন।";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/shop-settings", {
        method: "PUT",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          insideDhakaDeliveryCharge: Number(
            form.insideDhakaDeliveryCharge
          ),
          outsideDhakaDeliveryCharge: Number(
            form.outsideDhakaDeliveryCharge
          ),
          metaPixelId: form.metaPixelId.trim(),
          metaPixelEnabled: form.metaPixelEnabled,
        }),
      });

      const result = (await response.json()) as ShopSettingResponse;

      if (!response.ok || !result.success || !result.setting) {
            const responseField = result.field;

            if (isFieldName(responseField)) {
                setFieldErrors((current) => ({
                ...current,
                [responseField]: result.message || "Invalid value",
                }));
            }

            throw new Error(
                result.message || "Shop settings সংরক্ষণ করা যায়নি।"
            );
            }

      applySettingToForm(result.setting);
      setFieldErrors({});

      setSuccessMessage(
        result.message || "Shop settings সফলভাবে সংরক্ষণ করা হয়েছে।"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Shop settings সংরক্ষণ করা যায়নি।"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-72 rounded-2xl bg-slate-200" />
            <div className="h-72 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Shop Settings
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Reel checkout delivery charge এবং Meta Pixel configuration
              এখান থেকে নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last updated
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {formatDate(lastUpdatedAt)}
            </p>
          </div>
        </div>

        {successMessage ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-xl">
                  🚚
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Delivery Charge
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Public Reel checkout-এ ব্যবহৃত delivery charge নির্ধারণ
                    করুন।
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <label
                  htmlFor="insideDhakaDeliveryCharge"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Inside Dhaka
                </label>

                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-base font-bold text-slate-500">
                    ৳
                  </span>

                  <input
                    id="insideDhakaDeliveryCharge"
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    inputMode="decimal"
                    value={form.insideDhakaDeliveryCharge}
                    onChange={(event) =>
                      updateForm(
                        "insideDhakaDeliveryCharge",
                        event.target.value
                      )
                    }
                    className={[
                      "h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-base font-semibold text-slate-950 outline-none transition",
                      fieldErrors.insideDhakaDeliveryCharge
                        ? "border-red-400 ring-4 ring-red-100"
                        : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                    ].join(" ")}
                    disabled={isSaving}
                  />
                </div>

                {fieldErrors.insideDhakaDeliveryCharge ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {fieldErrors.insideDhakaDeliveryCharge}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Default charge: ৳70
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="outsideDhakaDeliveryCharge"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Outside Dhaka
                </label>

                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-base font-bold text-slate-500">
                    ৳
                  </span>

                  <input
                    id="outsideDhakaDeliveryCharge"
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    inputMode="decimal"
                    value={form.outsideDhakaDeliveryCharge}
                    onChange={(event) =>
                      updateForm(
                        "outsideDhakaDeliveryCharge",
                        event.target.value
                      )
                    }
                    className={[
                      "h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-base font-semibold text-slate-950 outline-none transition",
                      fieldErrors.outsideDhakaDeliveryCharge
                        ? "border-red-400 ring-4 ring-red-100"
                        : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                    ].join(" ")}
                    disabled={isSaving}
                  />
                </div>

                {fieldErrors.outsideDhakaDeliveryCharge ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {fieldErrors.outsideDhakaDeliveryCharge}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Default charge: ৳150
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-600">
                    Inside Dhaka preview
                  </span>

                  <strong className="text-slate-950">
                    ৳{formatMoney(form.insideDhakaDeliveryCharge)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-slate-600">
                    Outside Dhaka preview
                  </span>

                  <strong className="text-slate-950">
                    ৳{formatMoney(form.outsideDhakaDeliveryCharge)}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  📊
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Meta Pixel
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Reel page visitor এবং order conversion tracking নিয়ন্ত্রণ
                    করুন।
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    Enable Meta Pixel
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    চালু করলে Public Reel page-এ Meta Pixel events পাঠানো
                    হবে।
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.metaPixelEnabled}
                  onClick={() =>
                    updateForm(
                      "metaPixelEnabled",
                      !form.metaPixelEnabled
                    )
                  }
                  disabled={isSaving}
                  className={[
                    "relative h-8 w-14 shrink-0 rounded-full transition focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60",
                    form.metaPixelEnabled
                      ? "bg-orange-600"
                      : "bg-slate-300",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
                      form.metaPixelEnabled ? "left-7" : "left-1",
                    ].join(" ")}
                  />
                </button>
              </div>

              <div>
                <label
                  htmlFor="metaPixelId"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Meta Pixel ID
                </label>

                <input
                  id="metaPixelId"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Example: 123456789012345"
                  value={form.metaPixelId}
                  onChange={(event) =>
                    updateForm(
                      "metaPixelId",
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  className={[
                    "mt-2 h-12 w-full rounded-xl border bg-white px-4 text-base font-medium text-slate-950 outline-none transition",
                    fieldErrors.metaPixelId
                      ? "border-red-400 ring-4 ring-red-100"
                      : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                  ].join(" ")}
                  disabled={isSaving}
                  maxLength={30}
                />

                {fieldErrors.metaPixelId ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {fieldErrors.metaPixelId}
                  </p>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    শুধু Pixel ID লিখুন। সম্পূর্ণ JavaScript code এখানে
                    paste করবেন না।
                  </p>
                )}
              </div>

              <div
                className={[
                  "rounded-xl border px-4 py-3 text-sm",
                  form.metaPixelEnabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-600",
                ].join(" ")}
              >
                <span className="font-semibold">Current status:</span>{" "}
                {form.metaPixelEnabled
                  ? form.metaPixelId.trim()
                    ? `Enabled — Pixel ID ${form.metaPixelId.trim()}`
                    : "Enabled, but Pixel ID is required"
                  : "Disabled"}
              </div>
            </div>
          </section>

          <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Save করার পর নতুন Reel checkout order-এ updated delivery
                charge ব্যবহার হবে।
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void reloadSettings()}
                  disabled={isSaving || isLoading}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 min-w-36 rounded-xl bg-orange-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
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