import type { Metadata } from "next";

import StorefrontClient from "@/components/storefront/storefront-client";
import { siteConfig } from "@/lib/site-config";
import { getStorefrontData } from "@/lib/storefront";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.name,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
  },
};

export default async function HomePage() {
  const data = await getStorefrontData();
  return <StorefrontClient products={data.products} settings={data.settings} />;
}
