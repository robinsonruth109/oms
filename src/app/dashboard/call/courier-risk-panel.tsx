"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Truck } from "lucide-react";

import type { CustomerCourierScoreResult } from "@/lib/courier-score/types";

type ApiResponse = {
  success: boolean;
  message?: string;
  score?: CustomerCourierScoreResult | null;
  cached?: boolean;
};

const providerLabel: Record<string, string> = {
  PATHAO: "Pathao",
  STEADFAST: "Steadfast",
  REDX: "RedX",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      border: "border-emerald-200",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      bar: "bg-emerald-500",
      label: "Safe to ship",
      detail: "ভালো delivery history পাওয়া গেছে।",
    };
  }

  if (score >= 60) {
    return {
      border: "border-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-700",
      bar: "bg-amber-500",
      label: "Reconfirm before shipping",
      detail: "ঠিকানা ও অর্ডার আবার নিশ্চিত করুন।",
    };
  }

  return {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    bar: "bg-red-500",
    label: "High delivery risk",
    detail: "Dispatch করার আগে অতিরিক্ত verification করুন।",
  };
}

export default function CourierRiskPanel({ phone }: { phone: string }) {
  const [score, setScore] = useState<CustomerCourierScoreResult | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  useEffect(() => {
    let cancelled = false;

    async function loadCached() {
      setLoadingCache(true);
      setMessage(null);
      setScore(null);

      if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
        setLoadingCache(false);
        return;
      }

      try {
        const response = await fetch("/api/customer-courier-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cache", phone: normalizedPhone }),
        });
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;

        if (response.ok && data.success) {
          setScore(data.score ?? null);
        } else {
          setMessage(data.message || "Cached courier score লোড করা যায়নি।");
        }
      } catch {
        if (!cancelled) setMessage("Courier score cache লোড করা যায়নি।");
      } finally {
        if (!cancelled) setLoadingCache(false);
      }
    }

    void loadCached();
    return () => {
      cancelled = true;
    };
  }, [normalizedPhone]);

  async function refreshScore() {
    if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
      setMessage("সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।");
      return;
    }

    setRefreshing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/customer-courier-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", phone: normalizedPhone }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success || !data.score) {
        setMessage(data.message || "Courier history পাওয়া যায়নি।");
        return;
      }

      setScore(data.score);
    } catch {
      setMessage("Courier history check করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setRefreshing(false);
    }
  }

  if (loadingCache) {
    return (
      <div className="flex min-h-[116px] items-center justify-center rounded-2xl border bg-white px-5 py-4 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking saved courier score...
      </div>
    );
  }

  if (!score) {
    return (
      <div className="rounded-2xl border border-dashed bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-slate-500" />
              Customer Courier Score
            </div>
            <p className="mt-1 text-sm text-slate-500">
              এই নম্বরের courier history এখনো cache করা হয়নি।
            </p>
            {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
          </div>

          <button
            type="button"
            onClick={refreshScore}
            disabled={refreshing}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Truck className="mr-2 h-4 w-4" />
            )}
            {refreshing ? "Checking..." : "Check Score"}
          </button>
        </div>
      </div>
    );
  }

  const tone = scoreTone(score.successRate);
  const hasFailures = score.couriers.some((courier) => !courier.available);

  return (
    <div className={`rounded-2xl border ${tone.border} bg-white p-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5" />
              Customer Delivery Score
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.bg} ${tone.text}`}>
              {score.successRate.toFixed(0)}%
            </span>
            {hasFailures ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Partial data
              </span>
            ) : null}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${tone.bar}`}
              style={{ width: `${Math.max(0, Math.min(100, score.successRate))}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
              <p className="text-xs text-slate-500">Orders</p>
              <p className="text-lg font-bold text-slate-900">{score.totalOrders}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
              <p className="text-xs text-emerald-700">Delivered</p>
              <p className="text-lg font-bold text-emerald-700">{score.delivered}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2 text-center">
              <p className="text-xs text-red-700">Returned</p>
              <p className="text-lg font-bold text-red-700">{score.returned}</p>
            </div>
          </div>
        </div>

        <div className={`min-w-[220px] rounded-xl px-4 py-3 ${tone.bg}`}>
          <div className={`flex items-center gap-2 font-semibold ${tone.text}`}>
            {score.successRate >= 80 ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {tone.label}
          </div>
          <p className="mt-1 text-xs text-slate-600">{tone.detail}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {score.couriers.map((courier) => (
          <div key={courier.provider} className="rounded-xl border bg-slate-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {providerLabel[courier.provider] || courier.provider}
              </span>
              <span className="text-sm font-bold text-slate-900">
                {courier.available ? `${courier.successRate.toFixed(0)}%` : "N/A"}
              </span>
            </div>
            {courier.available ? (
              <p className="mt-1 text-xs text-slate-500">
                {courier.delivered} delivered · {courier.returned} returned · {courier.total} total
              </p>
            ) : (
              <p className="mt-1 text-xs text-red-600">{courier.error || "Unavailable"}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-slate-500">Updated: {formatDate(score.checkedAt)} · Cache: 24 hours</p>
        <div className="flex items-center gap-3">
          {message ? <span className="text-xs text-red-600">{message}</span> : null}
          <button
            type="button"
            onClick={refreshScore}
            disabled={refreshing}
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Score
          </button>
        </div>
      </div>
    </div>
  );
}
