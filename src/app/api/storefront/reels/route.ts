import { NextRequest, NextResponse } from "next/server";

import { loadStorefrontPage } from "@/lib/storefront";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

function readLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = readLimit(
      request.nextUrl.searchParams.get("limit")
    );

    const page = await loadStorefrontPage({
      cursor,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...page,
    });
  } catch (error) {
    console.error("Failed to load storefront reel page:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "পণ্যগুলো এখন লোড করা যাচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।",
      },
      { status: 503 }
    );
  }
}
