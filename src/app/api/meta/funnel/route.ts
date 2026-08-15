import { NextResponse } from "next/server";

import type { MetaFunnelEventName } from "@/lib/meta/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestBody = {
  eventName?: unknown;
  eventId?: unknown;
  eventSourceUrl?: unknown;
  sku?: unknown;
  quantity?: unknown;
  fbp?: unknown;
  fbc?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEventName(value: unknown): MetaFunnelEventName | null {
  return value === "AddToCart" || value === "InitiateCheckout" ? value : null;
}

function parseQuantity(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const eventName = parseEventName(body.eventName);
    const eventId = text(body.eventId);
    const eventSourceUrl = text(body.eventSourceUrl) || request.headers.get("referer") || "";
    const sku = text(body.sku);
    const quantity = parseQuantity(body.quantity);
    const fbp = text(body.fbp) || null;
    const fbc = text(body.fbc) || null;

    if (!eventName || !eventId || !sku) {
      return NextResponse.json(
        { success: false, message: "Invalid Meta funnel event." },
        { status: 400 },
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const [product, setting] = await Promise.all([
      prisma.product.findFirst({
        where: {
          sku,
          status: true,
          parent: { status: true },
        },
        select: {
          sku: true,
          name: true,
          sellingPrice: true,
          parent: { select: { sku: true } },
        },
      }),
      prisma.shopSetting.findUnique({
        where: { id: "default" },
        select: {
          metaPixelId: true,
          metaPixelEnabled: true,
          metaConversionsApiEnabled: true,
          metaTestEventCode: true,
          metaConversionsAccessTokenEncrypted: true,
          metaConversionsAccessTokenIv: true,
          metaConversionsAccessTokenTag: true,
        },
      }),
    ]);

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 },
      );
    }

    const pixelId =
      process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() ||
      (setting?.metaPixelEnabled ? setting.metaPixelId?.trim() || "" : "");

    let accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() || "";

    if (
      setting?.metaConversionsAccessTokenEncrypted &&
      setting.metaConversionsAccessTokenIv &&
      setting.metaConversionsAccessTokenTag
    ) {
      try {
        const { decryptSecret } = await import("@/lib/shop-settings-crypto");
        accessToken = decryptSecret({
          encrypted: setting.metaConversionsAccessTokenEncrypted,
          iv: setting.metaConversionsAccessTokenIv,
          tag: setting.metaConversionsAccessTokenTag,
        });
      } catch (error) {
        console.error("Failed to decrypt Meta CAPI token for funnel event:", error);
      }
    }

    if (!setting?.metaConversionsApiEnabled || !pixelId || !accessToken) {
      return NextResponse.json({ success: true, sent: false, reason: "CAPI disabled" });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIpAddress =
      forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    const clientUserAgent = request.headers.get("user-agent");
    const value = Number(product.sellingPrice.toString()) * quantity;

    const { sendMetaFunnelEvent } = await import("@/lib/meta/funnel");
    const metaResponse = await sendMetaFunnelEvent({
      pixelId,
      accessToken,
      testEventCode: process.env.META_TEST_EVENT_CODE || setting.metaTestEventCode,
      eventName,
      eventId,
      eventSourceUrl,
      sku: product.sku,
      parentSku: product.parent.sku,
      productName: product.name,
      quantity,
      value,
      currency: "BDT",
      clientIpAddress,
      clientUserAgent,
      fbp,
      fbc,
    });

    return NextResponse.json({ success: true, sent: true, metaResponse });
  } catch (error) {
    console.error("Meta funnel event failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Meta funnel event failed.",
      },
      { status: 500 },
    );
  }
}
