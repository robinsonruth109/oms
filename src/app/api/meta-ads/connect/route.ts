import { randomBytes } from "node:crypto";

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { metaGraphVersion, metaRedirectUri } from "@/lib/meta-ads/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const appId = process.env.META_ADS_APP_ID?.trim();
  if (!appId || !process.env.META_ADS_APP_SECRET?.trim()) {
    return NextResponse.redirect(
      new URL("/dashboard/ads-cost/sync?error=meta_app_not_configured", request.url)
    );
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = metaRedirectUri(request.nextUrl.origin);
  const cookieStore = await cookies();

  cookieStore.set("meta_ads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const dialog = new URL(
    "https://www.facebook.com/" + metaGraphVersion() + "/dialog/oauth"
  );
  dialog.searchParams.set("client_id", appId);
  dialog.searchParams.set("redirect_uri", redirectUri);
  dialog.searchParams.set("state", state);
  dialog.searchParams.set("response_type", "code");
  dialog.searchParams.set("scope", "ads_read");

  return NextResponse.redirect(dialog);
}
