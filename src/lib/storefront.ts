import type { StorefrontProduct, StorefrontSettings } from "@/components/storefront/types";

const SHOP_SETTING_ID = "default";

function money(value: { toString(): string } | null | undefined, fallback: number) {
  const parsed = Number(value?.toString());
  return (Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback).toFixed(2);
}

export async function getStorefrontData(reelId?: string): Promise<{ products: StorefrontProduct[]; settings: StorefrontSettings }> {
  const { prisma } = await import("@/lib/prisma");

  const [rows, setting] = await Promise.all([
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
    prisma.shopSetting.upsert({
      where: { id: SHOP_SETTING_ID },
      update: {},
      create: {
        id: SHOP_SETTING_ID,
        insideDhakaDeliveryCharge: 70,
        outsideDhakaDeliveryCharge: 150,
        metaPixelId: null,
        metaPixelEnabled: false,
        metaConversionsApiEnabled: false,
        metaTestEventCode: null,
      },
      select: {
        insideDhakaDeliveryCharge: true,
        outsideDhakaDeliveryCharge: true,
        metaPixelId: true,
        metaPixelEnabled: true,
      },
    }),
  ]);

  return {
    products: rows.filter((row) => row.category.slug).map((row) => ({
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
    settings: {
      insideDhakaDeliveryCharge: money(setting.insideDhakaDeliveryCharge, 70),
      outsideDhakaDeliveryCharge: money(setting.outsideDhakaDeliveryCharge, 150),
      metaPixelId: setting.metaPixelEnabled ? setting.metaPixelId : null,
    },
  };
}
