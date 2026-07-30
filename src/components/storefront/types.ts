export type StorefrontProduct = {
  reelId: string;
  categorySlug: string;
  title: string;
  caption: string | null;
  descriptionHtml: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  product: { id: string; name: string; sku: string; quantity: number; sellingPrice: string };
  gallery: Array<{ id: string; mediaType: string; url: string; altText: string | null; isPrimary: boolean }>;
};

export type StorefrontSettings = {
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  metaPixelId: string | null;
};
