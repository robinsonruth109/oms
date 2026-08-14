import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/lib/site-config";

import ReelFeed, {
  type PublicReelItem,
} from "./reel-feed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOP_SETTING_ID = "default";

const DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE = 70;
const DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE = 150;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();

  if (!normalizedSlug) {
    return {
      title: "Reels not found",
      robots: { index: false, follow: false },
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const category = await prisma.reelCategory.findFirst({
    where: {
      slug: normalizedSlug,
      status: true,
      source: { status: true },
      page: { status: true },
    },
    select: {
      name: true,
      slug: true,
      reelProducts: {
        where: { status: true, product: { status: true } },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          title: true,
          caption: true,
          thumbnailUrl: true,
          gallery: {
            where: { mediaType: "IMAGE" },
            orderBy: [
              { isPrimary: "desc" },
              { displayOrder: "asc" },
              { createdAt: "asc" },
            ],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  if (!category?.slug) {
    return {
      title: "Reels not found",
      robots: { index: false, follow: false },
    };
  }

  const firstReel = category.reelProducts[0];
  const title = category.name;
  const description =
    firstReel?.caption?.trim() ||
    `Watch ${category.name} product videos and order from ${siteConfig.name}.`;
  const image =
    firstReel?.thumbnailUrl || firstReel?.gallery[0]?.url || undefined;
  const canonicalPath = `/reels/${encodeURIComponent(category.slug)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: siteConfig.name,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function normalizeMoney(
  value: {
    toString(): string;
  } | null | undefined,
  fallback: number
): string {
  if (!value) {
    return fallback.toFixed(2);
  }

  const amount = Number(value.toString());

  if (!Number.isFinite(amount) || amount < 0) {
    return fallback.toFixed(2);
  }

  return amount.toFixed(2);
}

export default async function PublicReelCategoryPage({
  params,
}: PageProps) {
  const { slug } = await params;

  const normalizedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  if (!normalizedSlug) {
    notFound();
  }

  const { prisma } = await import("@/lib/prisma");

  const [category, shopSetting] = await Promise.all([
    prisma.reelCategory.findFirst({
      where: {
        slug: normalizedSlug,
        status: true,

        source: {
          status: true,
        },

        page: {
          status: true,
        },
      },

      select: {
        id: true,
        name: true,
        slug: true,

        reelProducts: {
          where: {
            status: true,

            product: {
              status: true,
            },
          },

          orderBy: [
            {
              displayOrder: "asc",
            },
            {
              createdAt: "desc",
            },
          ],

          select: {
            id: true,
            title: true,
            caption: true,
            descriptionHtml: true,
            videoUrl: true,
            thumbnailUrl: true,
            displayOrder: true,

            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                quantity: true,
                sellingPrice: true,
                parent: {
                  select: {
                    sku: true,
                    name: true,
                  },
                },
              },
            },

            gallery: {
              orderBy: [
                {
                  isPrimary: "desc",
                },
                {
                  displayOrder: "asc",
                },
                {
                  createdAt: "asc",
                },
              ],

              select: {
                id: true,
                mediaType: true,
                url: true,
                altText: true,
                displayOrder: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    }),

    prisma.shopSetting.upsert({
      where: {
        id: SHOP_SETTING_ID,
      },

      update: {},

      create: {
        id: SHOP_SETTING_ID,

        insideDhakaDeliveryCharge:
          DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE,

        outsideDhakaDeliveryCharge:
          DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE,

        metaPixelId: null,
        metaPixelEnabled: false,
      },

      select: {
        insideDhakaDeliveryCharge: true,
        outsideDhakaDeliveryCharge: true,
        metaPixelId: true,
        metaPixelEnabled: true,
      },
    }),
  ]);

  if (!category || !category.slug) {
    notFound();
  }

  const reels: PublicReelItem[] =
    category.reelProducts.map((reel) => ({
      id: reel.id,
      title: reel.title,
      caption: reel.caption,
      descriptionHtml: reel.descriptionHtml,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      displayOrder: reel.displayOrder,

      product: {
        id: reel.product.id,
        name: reel.product.name,
        sku: reel.product.sku,
        parentSku: reel.product.parent.sku,
        parentName: reel.product.parent.name,
        quantity: reel.product.quantity,
        sellingPrice:
          reel.product.sellingPrice.toString(),
      },

      gallery: reel.gallery.map((media) => ({
        id: media.id,
        mediaType: String(media.mediaType),
        url: media.url,
        altText: media.altText,
        displayOrder: media.displayOrder,
        isPrimary: media.isPrimary,
      })),
    }));

  const insideDhakaDeliveryCharge =
    normalizeMoney(
      shopSetting.insideDhakaDeliveryCharge,
      DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE
    );

  const outsideDhakaDeliveryCharge =
    normalizeMoney(
      shopSetting.outsideDhakaDeliveryCharge,
      DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE
    );

  const metaPixelId =
    shopSetting.metaPixelEnabled &&
    shopSetting.metaPixelId
      ? shopSetting.metaPixelId
      : null;

  const itemListJsonLd = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    name: category.name,
    itemListElement: reels.slice(0, 10).map((reel, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: reel.product.name,
        sku: reel.product.sku,
        productID: reel.product.sku,
        url: `${siteConfig.url}/product/${encodeURIComponent(reel.product.sku)}`,
        image:
          reel.thumbnailUrl ||
          reel.gallery.find((media) => media.mediaType.toUpperCase() === "IMAGE")?.url ||
          undefined,
        offers: {
          "@type": "Offer",
          price: Number(reel.product.sellingPrice),
          priceCurrency: "BDT",
          availability:
            reel.product.quantity > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <ReelFeed
      categoryName={category.name}
      categorySlug={category.slug}
      reels={reels}
      insideDhakaDeliveryCharge={
        insideDhakaDeliveryCharge
      }
      outsideDhakaDeliveryCharge={
        outsideDhakaDeliveryCharge
      }
      metaPixelId={metaPixelId}
      />
    </>
  );
}