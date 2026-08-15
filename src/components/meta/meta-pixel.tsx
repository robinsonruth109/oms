"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    __glossMetaPixelId?: string;
    __glossMetaPageViewTracked?: boolean;
  }
}

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: (...args: unknown[]) => void;
};

export function createMetaEventId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

export function createMetaSkuEventId(prefix: string, sku: string) {
  return `${prefix}_${sku}_${Date.now()}`;
}

export function sendMetaFunnelEventToServer(input: {
  eventName: "AddToCart" | "InitiateCheckout";
  eventId: string;
  sku: string;
  quantity: number;
}) {
  if (typeof window === "undefined") return;

  void fetch("/api/meta/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      eventSourceUrl: window.location.href,
      fbp: document.cookie
        .split("; ")
        .find((row) => row.startsWith("_fbp="))
        ?.split("=")
        .slice(1)
        .join("=") ?? null,
      fbc: document.cookie
        .split("; ")
        .find((row) => row.startsWith("_fbc="))
        ?.split("=")
        .slice(1)
        .join("=") ?? null,
    }),
    keepalive: true,
  }).catch((error) => {
    console.error("Meta funnel CAPI request failed:", error);
  });
}

function normalizeMetaEventParameters(
  parameters?: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...(parameters ?? {}) };

  if ("currency" in normalized) {
    const currency = String(normalized.currency ?? "")
      .trim()
      .toUpperCase();

    if (/^[A-Z]{3}$/.test(currency)) {
      normalized.currency = currency;
    } else {
      delete normalized.currency;
    }
  }

  if ("value" in normalized) {
    const value = Number(normalized.value);

    if (Number.isFinite(value) && value >= 0) {
      normalized.value = Math.round(value * 100) / 100;
    } else {
      delete normalized.value;
    }
  }

  return normalized;
}

export function trackMetaEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string
) {
  if (typeof window === "undefined" || !window.fbq) return;

  const normalizedParameters = normalizeMetaEventParameters(parameters);

  if (eventId) {
    window.fbq("track", eventName, normalizedParameters, { eventID: eventId });
    return;
  }

  window.fbq("track", eventName, normalizedParameters);
}

export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  useEffect(() => {
    if (!pixelId) return;

    const win = window as typeof window & { fbq?: MetaPixelFunction };
    if (!win.fbq) {
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      } as MetaPixelFunction;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.push = (...args: unknown[]) => fbq(...args);
      win.fbq = fbq;
      window._fbq = fbq;
    }

    if (!document.querySelector(`script[data-meta-pixel-id="${pixelId}"]`) && !window.__glossMetaPixelId) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.dataset.metaPixelId = pixelId;
      document.head.appendChild(script);
    }

    if (window.__glossMetaPixelId !== pixelId) {
      win.fbq?.("init", pixelId);
      window.__glossMetaPixelId = pixelId;
      window.__glossMetaPageViewTracked = false;
    }

    if (!window.__glossMetaPageViewTracked) {
      const pathLabel =
        window.location.pathname === "/"
          ? "home"
          : window.location.pathname
              .replace(/[^a-zA-Z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "") || "page";
      const eventId = `page_view_${pathLabel}_${Date.now()}`;
      trackMetaEvent("PageView", {}, eventId);
      window.__glossMetaPageViewTracked = true;
    }
  }, [pixelId]);

  return null;
}
