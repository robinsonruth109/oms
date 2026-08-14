import type {
  StorefrontPage,
  StorefrontProduct,
  StorefrontSettings,
} from "@/components/storefront/types";

const SHOP_SETTING_ID = "default";
const DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE = 70;
const DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE = 150;
const INITIAL_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const FIRST_PAGE_CACHE_TTL_MS = 30_000;
const SETTINGS_CACHE_TTL_MS = 60_000;
const RETRY_DELAYS_MS = [400, 1_000, 2_000] as const;

type StorefrontData = StorefrontPage & {
  settings: StorefrontSettings;
};

type LoadPageOptions = {
  cursor?: string | null;
  limit?: number;
  reelId?: string;
  categorySlug?: string;
};

let firstPageCache: StorefrontPage | null = null;
let firstPageCacheAt = 0;
let settingsCache: StorefrontSettings | null = null;
let settingsCacheAt = 0;

export function invalidateStorefrontFeedCache() {
  firstPageCache = null;
  firstPageCacheAt = 0;
}

function money(
  value: { toString(): string } | null | undefined,
  fallback: number
) {
  const parsed = Number(value?.toString());
  return (Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback
  ).toFixed(2);
}

function isTransientDatabaseError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);

  return /pool timeout|connection timeout|failed to create socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE/i.test(
    message
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withDatabaseRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        !isTransientDatabaseError(error) ||
        attempt === RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function defaultSettings(): StorefrontSettings {
  return {
    insideDhakaDeliveryCharge:
      DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE.toFixed(2),
    outsideDhakaDeliveryCharge:
      DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE.toFixed(2),
    metaPixelId: null,
  };
}

function clampPageSize(value?: number) {
  if (!Number.isFinite(value)) {
    return INITIAL_PAGE_SIZE;
  }

  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(value ?? INITIAL_PAGE_SIZE))
  );
}

function serializeProduct(row: {
  id: string;
  title: string;
  caption: string | null;
  descriptionHtml: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: { slug: string | null };
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string | null;
    quantity: number;
    sellingPrice: { toString(): string };
    parent: { sku: string; name: string };
  };
  gallery: Array<{
    id: string;
    mediaType: unknown;
    url: string;
    altText: string | null;
    isPrimary: boolean;
  }>;
}): StorefrontProduct | null {
  if (!row.category.slug) {
    return null;
  }

  return {
    reelId: row.id,
    categorySlug: row.category.slug,
    title: row.title,
    caption: row.caption,
    descriptionHtml: row.descriptionHtml,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    product: {
      id: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      slug: row.product.slug,
      parentSku: row.product.parent.sku,
      parentName: row.product.parent.name,
      quantity: row.product.quantity,
      sellingPrice: row.product.sellingPrice.toString(),
    },
    gallery: row.gallery.map((media) => ({
      ...media,
      mediaType: String(media.mediaType),
    })),
  };
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const now = Date.now();

  if (
    settingsCache &&
    now - settingsCacheAt < SETTINGS_CACHE_TTL_MS
  ) {
    return settingsCache;
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    const setting = await withDatabaseRetry(() =>
      prisma.shopSetting.findUnique({
        where: { id: SHOP_SETTING_ID },
        select: {
          insideDhakaDeliveryCharge: true,
          outsideDhakaDeliveryCharge: true,
          metaPixelId: true,
          metaPixelEnabled: true,
        },
      })
    );

    settingsCache = setting
      ? {
          insideDhakaDeliveryCharge: money(
            setting.insideDhakaDeliveryCharge,
            DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE
          ),
          outsideDhakaDeliveryCharge: money(
            setting.outsideDhakaDeliveryCharge,
            DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE
          ),
          metaPixelId: setting.metaPixelEnabled
            ? setting.metaPixelId
            : null,
        }
      : defaultSettings();
    settingsCacheAt = Date.now();

    return settingsCache;
  } catch (error) {
    if (settingsCache) {
      console.error(
        "Storefront settings database temporarily unavailable; serving cached settings:",
        error
      );
      return settingsCache;
    }

    if (isTransientDatabaseError(error)) {
      console.error(
        "Storefront settings database temporarily unavailable; serving defaults:",
        error
      );
      return defaultSettings();
    }

    throw error;
  }
}

export async function loadStorefrontPage({
  cursor = null,
  limit,
  reelId,
  categorySlug,
}: LoadPageOptions = {}): Promise<StorefrontPage> {
  const pageSize = reelId ? 1 : clampPageSize(limit);
  const now = Date.now();

  if (
    !reelId &&
    !categorySlug &&
    !cursor &&
    firstPageCache &&
    now - firstPageCacheAt < FIRST_PAGE_CACHE_TTL_MS
  ) {
    return firstPageCache;
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    const rows = await withDatabaseRetry(() =>
      prisma.reelProduct.findMany({
        where: {
          ...(reelId
            ? {
                OR: [
                  { id: reelId },
                  { product: { sku: reelId } },
                  { product: { slug: reelId } },
                ],
              }
            : {}),
          status: true,
          product: { status: true },
          category: {
            ...(categorySlug ? { slug: categorySlug } : {}),
            status: true,
            source: { status: true },
            page: { status: true },
          },
        },
        orderBy: categorySlug
          ? [
              { displayOrder: "asc" },
              { createdAt: "desc" },
              { id: "desc" },
            ]
          : [
              { updatedAt: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],
        ...(cursor && !reelId
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
        take: reelId ? 1 : pageSize + 1,
        select: {
          id: true,
          title: true,
          caption: true,
          descriptionHtml: true,
          videoUrl: true,
          thumbnailUrl: true,
          category: { select: { slug: true } },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              slug: true,
              quantity: true,
              sellingPrice: true,
              parent: { select: { sku: true, name: true } },
            },
          },
          gallery: {
            orderBy: [
              { isPrimary: "desc" },
              { displayOrder: "asc" },
              { createdAt: "asc" },
            ],
            select: {
              id: true,
              mediaType: true,
              url: true,
              altText: true,
              isPrimary: true,
            },
          },
        },
      })
    );

    const hasMore = !reelId && rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const products = pageRows
      .map(serializeProduct)
      .filter((product): product is StorefrontProduct => Boolean(product));

    const page: StorefrontPage = {
      products,
      nextCursor:
        hasMore && pageRows.length > 0
          ? pageRows[pageRows.length - 1].id
          : null,
      hasMore,
    };

    if (!reelId && !categorySlug && !cursor) {
      firstPageCache = page;
      firstPageCacheAt = Date.now();
    }

    return page;
  } catch (error) {
    if (!reelId && !categorySlug && !cursor && firstPageCache) {
      console.error(
        "Storefront database temporarily unavailable; serving cached first page:",
        error
      );
      return firstPageCache;
    }

    throw error;
  }
}

export async function getStorefrontData(
  reelId?: string
): Promise<StorefrontData> {
  const page = await loadStorefrontPage({
    reelId,
    limit: INITIAL_PAGE_SIZE,
  });
  const settings = await getStorefrontSettings();

  return {
    ...page,
    settings,
  };
}
