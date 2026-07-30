import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StorefrontClient from "@/components/storefront/storefront-client";
import { siteConfig } from "@/lib/site-config";
import { getStorefrontData } from "@/lib/storefront";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
};

function plainText(value: string | null | undefined): string {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, length = 160): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const data = await getStorefrontData(decodedSlug);
  const item = data.products[0];

  if (!item) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  }

  const title = item.product.name || item.title || "Product";
  const description = truncate(
    plainText(item.caption) ||
      plainText(item.descriptionHtml) ||
      `Buy ${title} from ${siteConfig.name}. Fast delivery across Bangladesh.`
  );
  const image =
    item.thumbnailUrl ||
    item.gallery.find((media) => media.mediaType.toLowerCase() === "image")?.url ||
    undefined;
  const canonicalPath = `/product/${encodeURIComponent(slug)}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
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

export default async function ProductDetailsPage({ params }: Props) {
  const { slug } = await params;
  const data = await getStorefrontData(decodeURIComponent(slug));

  if (!data.products.length) notFound();

  return (
    <StorefrontClient
      products={data.products}
      settings={data.settings}
      singleProduct
    />
  );
}
