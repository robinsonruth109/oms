import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createHash, randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/shop-settings-crypto";
import { withDatabaseRetry } from "@/lib/database-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOP_SETTING_ID = "default";
const MAX_DELIVERY_CHARGE = 100_000;

type Body = {
  insideDhakaDeliveryCharge?: unknown;
  outsideDhakaDeliveryCharge?: unknown;
  metaPixelId?: unknown;
  metaPixelEnabled?: unknown;
  metaConversionsApiEnabled?: unknown;
  metaTestEventCode?: unknown;
  metaConversionsAccessToken?: unknown;
  removeMetaConversionsAccessToken?: unknown;
  action?: unknown;
};

async function getCurrentUserRole() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  return (
    (session?.user as { role?: string } | undefined)?.role ||
    (session as { role?: string } | null)?.role ||
    null
  );
}

function isAdminRole(role: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function money(value: unknown) {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") {
    return Number.NaN;
  }
  return Math.round(Number(value) * 100) / 100;
}

function tokenConfigured(setting: {
  metaConversionsAccessTokenEncrypted: string | null;
  metaConversionsAccessTokenIv: string | null;
  metaConversionsAccessTokenTag: string | null;
}) {
  return Boolean(
    setting.metaConversionsAccessTokenEncrypted &&
      setting.metaConversionsAccessTokenIv &&
      setting.metaConversionsAccessTokenTag
  );
}

function serialize(setting: {
  id: string;
  insideDhakaDeliveryCharge: { toString(): string };
  outsideDhakaDeliveryCharge: { toString(): string };
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  metaConversionsApiEnabled: boolean;
  metaTestEventCode: string | null;
  metaConversionsAccessTokenEncrypted: string | null;
  metaConversionsAccessTokenIv: string | null;
  metaConversionsAccessTokenTag: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let maskedToken: string | null = null;
  if (tokenConfigured(setting)) {
    try {
      maskedToken = maskSecret(
        decryptSecret({
          encrypted: setting.metaConversionsAccessTokenEncrypted!,
          iv: setting.metaConversionsAccessTokenIv!,
          tag: setting.metaConversionsAccessTokenTag!,
        })
      );
    } catch {
      maskedToken = "Configured (unable to decrypt with current key)";
    }
  }

  return {
    id: setting.id,
    insideDhakaDeliveryCharge: setting.insideDhakaDeliveryCharge.toString(),
    outsideDhakaDeliveryCharge: setting.outsideDhakaDeliveryCharge.toString(),
    metaPixelId: setting.metaPixelId,
    metaPixelEnabled: setting.metaPixelEnabled,
    metaConversionsApiEnabled: setting.metaConversionsApiEnabled,
    metaTestEventCode: setting.metaTestEventCode,
    metaConversionsAccessTokenConfigured: tokenConfigured(setting),
    metaConversionsAccessTokenMasked: maskedToken,
    createdAt: setting.createdAt.toISOString(),
    updatedAt: setting.updatedAt.toISOString(),
  };
}

async function findSetting() {
  const { prisma } = await import("@/lib/prisma");
  return withDatabaseRetry(() =>
    prisma.shopSetting.findUnique({ where: { id: SHOP_SETTING_ID } })
  );
}

function serializeDefaults() {
  const now = new Date().toISOString();
  return {
    id: SHOP_SETTING_ID,
    insideDhakaDeliveryCharge: "70.00",
    outsideDhakaDeliveryCharge: "150.00",
    metaPixelId: null,
    metaPixelEnabled: false,
    metaConversionsApiEnabled: false,
    metaTestEventCode: null,
    metaConversionsAccessTokenConfigured: false,
    metaConversionsAccessTokenMasked: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET() {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const setting = await findSetting();
    return NextResponse.json({
      success: true,
      setting: setting ? serialize(setting) : serializeDefaults(),
    });
  } catch (error) {
    console.error("Failed to load shop settings:", error);
    return NextResponse.json({ success: false, message: "Shop settings লোড করা যায়নি।" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const inside = money(body.insideDhakaDeliveryCharge);
    const outside = money(body.outsideDhakaDeliveryCharge);
    const pixelEnabled = bool(body.metaPixelEnabled);
    const capiEnabled = bool(body.metaConversionsApiEnabled);
    const removeToken = bool(body.removeMetaConversionsAccessToken) === true;
    const pixelId = text(body.metaPixelId) || null;
    const testEventCode = text(body.metaTestEventCode) || null;
    const newToken = text(body.metaConversionsAccessToken);

    if (!Number.isFinite(inside) || inside < 0 || inside > MAX_DELIVERY_CHARGE) {
      return NextResponse.json({ success: false, field: "insideDhakaDeliveryCharge", message: "Inside Dhaka delivery charge সঠিক নয়।" }, { status: 400 });
    }
    if (!Number.isFinite(outside) || outside < 0 || outside > MAX_DELIVERY_CHARGE) {
      return NextResponse.json({ success: false, field: "outsideDhakaDeliveryCharge", message: "Outside Dhaka delivery charge সঠিক নয়।" }, { status: 400 });
    }
    if (pixelEnabled === null || capiEnabled === null) {
      return NextResponse.json({ success: false, message: "Meta status সঠিক নয়।" }, { status: 400 });
    }
    if (pixelId && !/^\d{5,30}$/.test(pixelId)) {
      return NextResponse.json({ success: false, field: "metaPixelId", message: "Meta Pixel ID-তে শুধু সংখ্যা থাকতে পারবে।" }, { status: 400 });
    }
    if ((pixelEnabled || capiEnabled) && !pixelId) {
      return NextResponse.json({ success: false, field: "metaPixelId", message: "Meta Pixel অথবা CAPI চালু করতে Pixel ID লিখুন।" }, { status: 400 });
    }

    const existing = await findSetting();
    const alreadyHasToken = existing ? tokenConfigured(existing) : false;
    if (capiEnabled && !newToken && !alreadyHasToken && !process.env.META_CONVERSIONS_ACCESS_TOKEN) {
      return NextResponse.json({ success: false, field: "metaConversionsAccessToken", message: "Conversions API চালু করতে Access Token লিখুন।" }, { status: 400 });
    }

    const tokenUpdate: {
      metaConversionsAccessTokenEncrypted?: string | null;
      metaConversionsAccessTokenIv?: string | null;
      metaConversionsAccessTokenTag?: string | null;
    } = {};

    if (removeToken) {
      tokenUpdate.metaConversionsAccessTokenEncrypted = null;
      tokenUpdate.metaConversionsAccessTokenIv = null;
      tokenUpdate.metaConversionsAccessTokenTag = null;
    } else if (newToken) {
      const encrypted = encryptSecret(newToken);
      tokenUpdate.metaConversionsAccessTokenEncrypted = encrypted.encrypted;
      tokenUpdate.metaConversionsAccessTokenIv = encrypted.iv;
      tokenUpdate.metaConversionsAccessTokenTag = encrypted.tag;
    }

    const { prisma } = await import("@/lib/prisma");
    const setting = await withDatabaseRetry(() =>
      prisma.shopSetting.upsert({
        where: { id: SHOP_SETTING_ID },
        create: {
          id: SHOP_SETTING_ID,
          insideDhakaDeliveryCharge: inside.toFixed(2),
          outsideDhakaDeliveryCharge: outside.toFixed(2),
          metaPixelId: pixelId,
          metaPixelEnabled: pixelEnabled,
          metaConversionsApiEnabled: capiEnabled,
          metaTestEventCode: testEventCode,
          ...tokenUpdate,
        },
        update: {
          insideDhakaDeliveryCharge: inside.toFixed(2),
          outsideDhakaDeliveryCharge: outside.toFixed(2),
          metaPixelId: pixelId,
          metaPixelEnabled: pixelEnabled,
          metaConversionsApiEnabled: capiEnabled,
          metaTestEventCode: testEventCode,
          ...tokenUpdate,
        },
      })
    );

    return NextResponse.json({ success: true, message: "Shop settings সফলভাবে সংরক্ষণ করা হয়েছে।", setting: serialize(setting) });
  } catch (error) {
    console.error("Failed to update shop settings:", error);
    const message = error instanceof Error && error.message.includes("SHOP_SETTINGS_ENCRYPTION_KEY")
      ? "SHOP_SETTINGS_ENCRYPTION_KEY configure না করলে Access Token save করা যাবে না।"
      : "Shop settings সংরক্ষণ করা যায়নি।";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    if (body.action !== "testMetaConnection") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    const setting = await findSetting();
    if (!setting) {
      return NextResponse.json(
        { success: false, message: "Shop settings আগে save করুন।" },
        { status: 400 }
      );
    }

    const pixelId = setting.metaPixelId;
    let accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() || "";

    if (tokenConfigured(setting)) {
      accessToken = decryptSecret({
        encrypted: setting.metaConversionsAccessTokenEncrypted!,
        iv: setting.metaConversionsAccessTokenIv!,
        tag: setting.metaConversionsAccessTokenTag!,
      });
    }

    if (!pixelId || !accessToken) {
      return NextResponse.json(
        { success: false, message: "Pixel ID এবং Access Token আগে save করুন।" },
        { status: 400 }
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIpAddress = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
    const clientUserAgent = request.headers.get("user-agent") || "OMS Meta CAPI Test";
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const eventSourceUrl = `${siteUrl}/dashboard/shop-settings`;
    const eventId = `oms_meta_test_${Date.now()}_${randomUUID()}`;
    const externalId = createHash("sha256").update("oms-meta-capi-connection-test").digest("hex");

    const userData: Record<string, unknown> = {
      client_user_agent: clientUserAgent,
      external_id: [externalId],
    };
    if (clientIpAddress) userData.client_ip_address = clientIpAddress;

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: "PageView",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl,
          action_source: "website",
          user_data: userData,
          custom_data: {
            integration_test: true,
            source: "oms_shop_settings",
          },
        },
      ],
    };

    if (setting.metaTestEventCode?.trim()) {
      payload.test_event_code = setting.metaTestEventCode.trim();
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    const data = (await response.json()) as {
      events_received?: number;
      messages?: string[];
      fbtrace_id?: string;
      error?: {
        message?: string;
        type?: string;
        code?: number;
        error_subcode?: number;
        error_user_title?: string;
        error_user_msg?: string;
      };
    };

    if (!response.ok || data.error || !data.events_received) {
      const metaMessage =
        data.error?.error_user_msg ||
        data.error?.message ||
        data.messages?.join(" ") ||
        "Meta test event গ্রহণ করেনি।";

      return NextResponse.json(
        {
          success: false,
          message: `Meta test failed: ${metaMessage}`,
        },
        { status: 400 }
      );
    }

    const testModeMessage = setting.metaTestEventCode?.trim()
      ? "Meta Events Manager-এর Test events tab-এ eventটি দেখুন।"
      : "Test Event Code দেওয়া ছিল না, তাই eventটি সাধারণ server event হিসেবে পাঠানো হয়েছে।";

    return NextResponse.json({
      success: true,
      message: `Meta CAPI connected — ${data.events_received}টি PageView event গ্রহণ করেছে। ${testModeMessage}`,
    });
  } catch (error) {
    console.error("Meta test event failed:", error);
    const message =
      error instanceof Error && error.message.includes("SHOP_SETTINGS_ENCRYPTION_KEY")
        ? "Saved token decrypt করা যায়নি। Railway-এর SHOP_SETTINGS_ENCRYPTION_KEY যাচাই করুন।"
        : "Meta test event পাঠানো যায়নি।";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
