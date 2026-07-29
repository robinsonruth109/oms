import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOP_SETTING_ID = "default";

const DEFAULT_INSIDE_DHAKA_DELIVERY_CHARGE = 70;
const DEFAULT_OUTSIDE_DHAKA_DELIVERY_CHARGE = 150;

const MAX_DELIVERY_CHARGE = 100_000;

type UpdateShopSettingBody = {
  insideDhakaDeliveryCharge?: unknown;
  outsideDhakaDeliveryCharge?: unknown;
  metaPixelId?: unknown;
  metaPixelEnabled?: unknown;
};

type ValidationSuccess = {
  success: true;
  data: {
    insideDhakaDeliveryCharge: number;
    outsideDhakaDeliveryCharge: number;
    metaPixelId: string | null;
    metaPixelEnabled: boolean;
  };
};

type ValidationFailure = {
  success: false;
  field?: string;
  message: string;
};

type ValidationResult = ValidationSuccess | ValidationFailure;

async function getCurrentUserRole() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  const role =
    (session?.user as { role?: string } | undefined)?.role ||
    (session as { role?: string } | null)?.role;

  return role || null;
}

function isAdminRole(role: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normalizeMoney(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    return Number.NaN;
  }

  if (typeof value === "string" && value.trim() === "") {
    return Number.NaN;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return Number.NaN;
  }

  return Math.round(amount * 100) / 100;
}

function isValidMetaPixelId(value: string): boolean {
  return /^\d{5,30}$/.test(value);
}

function validateBody(body: UpdateShopSettingBody): ValidationResult {
  const insideDhakaDeliveryCharge = normalizeMoney(
    body.insideDhakaDeliveryCharge
  );

  if (!Number.isFinite(insideDhakaDeliveryCharge)) {
    return {
      success: false,
      field: "insideDhakaDeliveryCharge",
      message: "Inside Dhaka delivery charge সঠিকভাবে লিখুন।",
    };
  }

  if (insideDhakaDeliveryCharge < 0) {
    return {
      success: false,
      field: "insideDhakaDeliveryCharge",
      message: "Inside Dhaka delivery charge ঋণাত্মক হতে পারবে না।",
    };
  }

  if (insideDhakaDeliveryCharge > MAX_DELIVERY_CHARGE) {
    return {
      success: false,
      field: "insideDhakaDeliveryCharge",
      message: "Inside Dhaka delivery charge অনেক বেশি হয়েছে।",
    };
  }

  const outsideDhakaDeliveryCharge = normalizeMoney(
    body.outsideDhakaDeliveryCharge
  );

  if (!Number.isFinite(outsideDhakaDeliveryCharge)) {
    return {
      success: false,
      field: "outsideDhakaDeliveryCharge",
      message: "Outside Dhaka delivery charge সঠিকভাবে লিখুন।",
    };
  }

  if (outsideDhakaDeliveryCharge < 0) {
    return {
      success: false,
      field: "outsideDhakaDeliveryCharge",
      message: "Outside Dhaka delivery charge ঋণাত্মক হতে পারবে না।",
    };
  }

  if (outsideDhakaDeliveryCharge > MAX_DELIVERY_CHARGE) {
    return {
      success: false,
      field: "outsideDhakaDeliveryCharge",
      message: "Outside Dhaka delivery charge অনেক বেশি হয়েছে।",
    };
  }

  const metaPixelEnabled = normalizeBoolean(body.metaPixelEnabled);

  if (metaPixelEnabled === null) {
    return {
      success: false,
      field: "metaPixelEnabled",
      message: "Meta Pixel status সঠিক নয়।",
    };
  }

  const normalizedMetaPixelId = normalizeText(body.metaPixelId);
  const metaPixelId = normalizedMetaPixelId || null;

  if (metaPixelId && !isValidMetaPixelId(metaPixelId)) {
    return {
      success: false,
      field: "metaPixelId",
      message:
        "সঠিক Meta Pixel ID লিখুন। Pixel ID-তে শুধুমাত্র সংখ্যা থাকবে।",
    };
  }

  if (metaPixelEnabled && !metaPixelId) {
    return {
      success: false,
      field: "metaPixelId",
      message: "Meta Pixel চালু করতে Pixel ID লিখুন।",
    };
  }

  return {
    success: true,
    data: {
      insideDhakaDeliveryCharge,
      outsideDhakaDeliveryCharge,
      metaPixelId,
      metaPixelEnabled,
    },
  };
}

function serializeShopSetting(setting: {
  id: string;
  insideDhakaDeliveryCharge: {
    toString(): string;
  };
  outsideDhakaDeliveryCharge: {
    toString(): string;
  };
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: setting.id,
    insideDhakaDeliveryCharge:
      setting.insideDhakaDeliveryCharge.toString(),
    outsideDhakaDeliveryCharge:
      setting.outsideDhakaDeliveryCharge.toString(),
    metaPixelId: setting.metaPixelId,
    metaPixelEnabled: setting.metaPixelEnabled,
    createdAt: setting.createdAt.toISOString(),
    updatedAt: setting.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const role = await getCurrentUserRole();

    if (!isAdminRole(role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const setting = await prisma.shopSetting.upsert({
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
    });

    return NextResponse.json({
      success: true,
      setting: serializeShopSetting(setting),
    });
  } catch (error) {
    console.error("Failed to load shop settings:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Shop settings লোড করা যায়নি।",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const role = await getCurrentUserRole();

    if (!isAdminRole(role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }

    let body: UpdateShopSettingBody;

    try {
      body = (await request.json()) as UpdateShopSettingBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "সঠিক settings data পাওয়া যায়নি।",
        },
        {
          status: 400,
        }
      );
    }

    const validation = validateBody(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          field: validation.field,
          message: validation.message,
        },
        {
          status: 400,
        }
      );
    }

    const {
      insideDhakaDeliveryCharge,
      outsideDhakaDeliveryCharge,
      metaPixelId,
      metaPixelEnabled,
    } = validation.data;

    const { prisma } = await import("@/lib/prisma");

    const setting = await prisma.shopSetting.upsert({
      where: {
        id: SHOP_SETTING_ID,
      },
      update: {
        insideDhakaDeliveryCharge:
          insideDhakaDeliveryCharge.toFixed(2),
        outsideDhakaDeliveryCharge:
          outsideDhakaDeliveryCharge.toFixed(2),
        metaPixelId,
        metaPixelEnabled,
      },
      create: {
        id: SHOP_SETTING_ID,
        insideDhakaDeliveryCharge:
          insideDhakaDeliveryCharge.toFixed(2),
        outsideDhakaDeliveryCharge:
          outsideDhakaDeliveryCharge.toFixed(2),
        metaPixelId,
        metaPixelEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Shop settings সফলভাবে সংরক্ষণ করা হয়েছে।",
      setting: serializeShopSetting(setting),
    });
  } catch (error) {
    console.error("Failed to update shop settings:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Shop settings সংরক্ষণ করা যায়নি।",
      },
      {
        status: 500,
      }
    );
  }
}