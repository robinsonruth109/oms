"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
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

    if (!document.querySelector(`script[data-meta-pixel-id="${pixelId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.dataset.metaPixelId = pixelId;
      document.head.appendChild(script);
      win.fbq?.("init", pixelId);
    }
    trackMetaEvent("PageView");
  }, [pixelId]);

  return null;
}
