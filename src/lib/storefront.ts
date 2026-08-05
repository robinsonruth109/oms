import type { StorefrontProduct, StorefrontSettings } from "@/components/storefront/types";

const SHOP_SETTING_ID = "default";
const DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE = 70;
const DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE = 150;
const SUCCESS_CACHE_TTL_MS = 30_000;
const RETRY_DELAYS_MS = [400, 1_000, 2_000] as const;

type StorefrontData = {
  products: StorefrontProduct[];
  settings: StorefrontSettings;
};

let lastSuccessfulData: StorefrontData | null = null;
let lastSuccessfulAt = 0;

function money(value: { toString(): string } | null | undefined, fallback: number) {
  const parsed = Number(value?.toString());
  return (Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback).toFixed(2);
}

function isTransientDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /pool timeout|connection timeout|failed to create socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE/i.test(message);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withDatabaseRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientDatabaseError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function defaultSettings(): StorefrontSettings {
  return {
    insideDhakaDeliveryCharge: DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE.toFixed(2),
    outsideDhakaDeliveryCharge: DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE.toFixed(2),
    metaPixelId: null,
  };
}

export async function getStorefrontData(reelId?: string): Promise<StorefrontData> {
  const now = Date.now();

  if (!reelId && lastSuccessfulData && now - lastSuccessfulAt < SUCCESS_CACHE_TTL_MS) {
    return lastSuccessfulData;
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    const rows = await withDatabaseRetry(() =>
      prisma.reelProduct.findMany({
        where: {
          ...(reelId ? { id: reelId } : {}),
          status: true,
          product: { status: true },
          category: { status: true, source: { status: true }, page: { status: true } },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          caption: true,
          descriptionHtml: true,
          videoUrl: true,
          thumbnailUrl: true,
          category: { select: { slug: true } },
          product: { select: { id: true, name: true, sku: true, quantity: true, sellingPrice: true } },
          gallery: {
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, mediaType: true, url: true, altText: true, isPrimary: true },
          },
        },
      }),
    );

    // Read settings after products instead of opening two connections simultaneously.
    const setting = await withDatabaseRetry(() =>
      prisma.shopSetting.findUnique({
        where: { id: SHOP_SETTING_ID },
        select: {
          insideDhakaDeliveryCharge: true,
          outsideDhakaDeliveryCharge: true,
          metaPixelId: true,
          metaPixelEnabled: true,
        },
      }),
    );

    const data: StorefrontData = {
      products: rows
        .filter((row) => row.category.slug)
        .map((row) => ({
          reelId: row.id,
          categorySlug: row.category.slug!,
          title: row.title,
          caption: row.caption,
          descriptionHtml: row.descriptionHtml,
          videoUrl: row.videoUrl,
          thumbnailUrl: row.thumbnailUrl,
          product: {
            id: row.product.id,
            name: row.product.name,
            sku: row.product.sku,
            quantity: row.product.quantity,
            sellingPrice: row.product.sellingPrice.toString(),
          },
          gallery: row.gallery.map((media) => ({ ...media, mediaType: String(media.mediaType) })),
        })),
      settings: setting
        ? {
            insideDhakaDeliveryCharge: money(
              setting.insideDhakaDeliveryCharge,
              DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE,
            ),
            outsideDhakaDeliveryCharge: money(
              setting.outsideDhakaDeliveryCharge,
              DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE,
            ),
            metaPixelId: setting.metaPixelEnabled ? setting.metaPixelId : null,
          }
        : defaultSettings(),
    };

    if (!reelId) {
      lastSuccessfulData = data;
      lastSuccessfulAt = Date.now();
    }

    return data;
  } catch (error) {
    if (!reelId && lastSuccessfulData) {
      console.error("Storefront database temporarily unavailable; serving last successful data:", error);
      return lastSuccessfulData;
    }

    throw error;
  }
}
