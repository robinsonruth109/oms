import type { Metadata } from "next";
import Link from "next/link";
import { Home, PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";

import StorefrontClient from "@/components/storefront/storefront-client";
import { getStorefrontSettings, loadStorefrontPage } from "@/lib/storefront";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getCategory(slug: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.reelCategory.findFirst({
    where: {
      slug,
      status: true,
      source: { status: true },
      page: { status: true },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      collectionVideoUrl: true,
      reelProducts: {
        where: { status: true, product: { status: true } },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          thumbnailUrl: true,
          caption: true,
          gallery: {
            where: { mediaType: "IMAGE" },
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const normalized = decodeURIComponent(slug).trim().toLowerCase();
  const category = normalized ? await getCategory(normalized) : null;

  if (!category?.slug) {
    return {
      title: "Collection not found",
      robots: { index: false, follow: false },
    };
  }

  const first = category.reelProducts[0];
  const description =
    first?.caption?.trim() ||
    `Shop ${category.name} products from ${siteConfig.name}.`;
  const image = first?.thumbnailUrl || first?.gallery[0]?.url || undefined;
  const url = `/collections/${encodeURIComponent(category.slug)}`;

  return {
    title: category.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: category.name,
      description,
      url,
      siteName: siteConfig.name,
      images: image ? [{ url: image, alt: category.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: category.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const normalized = decodeURIComponent(slug).trim().toLowerCase();

  if (!normalized) notFound();

  const [category, page, settings] = await Promise.all([
    getCategory(normalized),
    loadStorefrontPage({ categorySlug: normalized, limit: 12 }),
    getStorefrontSettings(),
  ]);

  if (!category?.slug) notFound();

  const groupedProducts = new Map<string, typeof page.products>();
  for (const product of page.products) {
    const current = groupedProducts.get(product.product.parentSku) ?? [];
    current.push(product);
    groupedProducts.set(product.product.parentSku, current);
  }

  const productSchema = Array.from(groupedProducts.entries()).map(([parentSku, products]) => {
    const variants = products.map((item) => {
      const image =
        item.thumbnailUrl ||
        item.gallery.find((media) => media.mediaType.toUpperCase() === "IMAGE")?.url ||
        undefined;
      const price = Number(item.product.sellingPrice);

      return {
        "@type": "Product",
        name: item.product.name,
        sku: item.product.sku,
        productID: item.product.sku,
        mpn: item.product.sku,
        image,
        url: `${siteConfig.url}/product/${encodeURIComponent(item.product.sku)}`,
        offers: {
          "@type": "Offer",
          price: Number.isFinite(price) ? price : 0,
          priceCurrency: "BDT",
          availability:
            item.product.quantity > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        },
      };
    });

    if (variants.length > 1) {
      return {
        "@type": "ProductGroup",
        name: products[0]?.product.parentName || category.name,
        productGroupID: parentSku,
        hasVariant: variants,
      };
    }

    return variants[0];
  }).filter(Boolean);

  const collectionJsonLd = {
    "@context": "https://schema.org/",
    "@graph": productSchema,
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            হোম
          </Link>

          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600 sm:text-xs">
              Gloss & Glows
            </p>
          </div>

          <Link
            href={`/reels/${encodeURIComponent(category.slug)}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <PlayCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Reels</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-5 pt-7 text-center sm:px-6 sm:pb-7 sm:pt-10">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-600">
          Collection
        </p>
        <h1 className="mx-auto mt-2 max-w-3xl text-balance text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
          {category.name}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          ভিডিও দেখুন, পছন্দের পণ্য বেছে নিন এবং সহজে অর্ডার করুন
        </p>
      </section>

      {category.collectionVideoUrl ? (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:rounded-3xl">
            <video
              src={category.collectionVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
              className="aspect-video w-full bg-black object-cover"
            />
          </div>
        </section>
      ) : null}

      <section className="mt-6 border-t border-slate-200/70 bg-white sm:mt-10">
        <StorefrontClient
          products={page.products}
          settings={settings}
          initialNextCursor={page.nextCursor}
          initialHasMore={page.hasMore}
          displayMode="collection"
          collectionTitle={category.name}
          hideCollectionHeader
          loadMoreEndpoint={`/api/storefront/collections/${encodeURIComponent(category.slug)}`}
        />
      </section>
    </main>
  );
}
