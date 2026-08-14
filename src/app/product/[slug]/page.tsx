import type { Metadata } from "next";
import { notFound } from "next/navigation";

import MetaViewContent from "@/components/meta/MetaViewContent";
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

function productImages(item: Awaited<ReturnType<typeof getStorefrontData>>["products"][number]) {
  const images = item.gallery
    .filter((media) => media.mediaType.toUpperCase() === "IMAGE")
    .map((media) => media.url);

  if (item.thumbnailUrl && !images.includes(item.thumbnailUrl)) {
    images.unshift(item.thumbnailUrl);
  }

  return images;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const data = await getStorefrontData(decoded);
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
  const images = productImages(item);
  const image = images[0];
  const canonicalPath = `/product/${encodeURIComponent(item.product.sku)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
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
  const item = data.products[0];

  if (!item) notFound();

  const price = Number(item.product.sellingPrice);
  const images = productImages(item);
  const canonicalUrl = `${siteConfig.url}/product/${encodeURIComponent(item.product.sku)}`;
  const description =
    plainText(item.caption) || plainText(item.descriptionHtml) || item.product.name;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: item.product.name,
    sku: item.product.sku,
    productID: item.product.sku,
    mpn: item.product.sku,
    image: images,
    description,
    url: canonicalUrl,
    brand: {
      "@type": "Brand",
      name: "Gloss & Glows",
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: Number.isFinite(price) ? price : 0,
      priceCurrency: "BDT",
      availability:
        item.product.quantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:retailer_item_id" content={item.product.sku} />
      <meta property="product:item_group_id" content={item.product.parentSku} />
      <meta property="product:price:amount" content={Number.isFinite(price) ? price.toFixed(2) : "0.00"} />
      <meta property="product:price:currency" content="BDT" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MetaViewContent
        sku={item.product.sku}
        parentSku={item.product.parentSku}
        name={item.product.name}
        price={Number.isFinite(price) ? price : 0}
      />
      <StorefrontClient
        products={data.products}
        settings={data.settings}
        singleProduct
      />
    </>
  );
}
