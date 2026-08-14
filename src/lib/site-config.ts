const DEFAULT_SITE_NAME = "Gloss & Glows";
const DEFAULT_SITE_DESCRIPTION =
  "Shop beauty and lifestyle products from Gloss & Glows with fast delivery across Bangladesh.";

function normalizeSiteUrl(value: string | undefined): string {
  const fallback = "https://glossandglows.com";

  if (!value) return fallback;

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || DEFAULT_SITE_NAME,
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
    DEFAULT_SITE_DESCRIPTION,
  url: normalizeSiteUrl(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL),
};
