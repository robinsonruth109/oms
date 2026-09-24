import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getMetaUser,
  listMetaAdAccounts,
  metaRedirectUri,
} from "@/lib/meta-ads/client";
import { encryptSecret } from "@/lib/shop-settings-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function target(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/dashboard/ads-cost/sync", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_ads_oauth_state")?.value;
  cookieStore.delete("meta_ads_oauth_state");

  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(target(request, { error: oauthError }));
  }

  if (!expectedState || !state || expectedState !== state) {
    return NextResponse.redirect(target(request, { error: "Invalid Meta OAuth state." }));
  }

  if (!code) {
    return NextResponse.redirect(target(request, { error: "Meta did not return an authorization code." }));
  }

  try {
    const redirectUri = metaRedirectUri(request.nextUrl.origin);
    const shortToken = await exchangeCodeForToken({ code, redirectUri });

    let accessToken = shortToken.access_token;
    let expiresIn = shortToken.expires_in;

    try {
      const longToken = await exchangeForLongLivedToken(shortToken.access_token);
      accessToken = longToken.access_token;
      expiresIn = longToken.expires_in;
    } catch (error) {
      console.warn("[MetaAds] Long-lived token exchange failed; using returned token.", error);
    }

    const [metaUser, adAccounts] = await Promise.all([
      getMetaUser(accessToken),
      listMetaAdAccounts(accessToken),
    ]);

    const encrypted = encryptSecret(accessToken);
    const tokenExpiresAt =
      expiresIn && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

    const { prisma } = await import("@/lib/prisma");

    // Commit the parent connection first. With Prisma's MariaDB driver adapter,
    // creating the connection and child ad-account rows inside one interactive
    // transaction can surface a false FK violation on connectionId.
    const connection = await prisma.metaAdsConnection.upsert({
      where: { metaUserId: metaUser.id },
      create: {
        metaUserId: metaUser.id,
        metaUserName: metaUser.name || null,
        accessTokenEncrypted: encrypted.encrypted,
        accessTokenIv: encrypted.iv,
        accessTokenTag: encrypted.tag,
        tokenExpiresAt,
        status: true,
        lastSyncStatus: "CONNECTED",
        lastSyncMessage: adAccounts.length + " accessible ad account(s) found.",
      },
      update: {
        metaUserName: metaUser.name || null,
        accessTokenEncrypted: encrypted.encrypted,
        accessTokenIv: encrypted.iv,
        accessTokenTag: encrypted.tag,
        tokenExpiresAt,
        status: true,
        lastSyncStatus: "CONNECTED",
        lastSyncMessage: adAccounts.length + " accessible ad account(s) found.",
      },
      select: { id: true },
    });

    // Re-read after the upsert so the parent row is definitely visible to the
    // following independent statements before child rows reference it.
    const persistedConnection = await prisma.metaAdsConnection.findUniqueOrThrow({
      where: { id: connection.id },
      select: { id: true },
    });

    for (const account of adAccounts) {
      const metaAccountId = String(
        account.account_id || account.id.replace(/^act_/, "")
      );

      await prisma.metaAdAccount.upsert({
        where: { metaAccountId },
        create: {
          connection: {
            connect: { id: persistedConnection.id },
          },
          metaAccountId,
          name: account.name || "Meta Ad Account " + metaAccountId,
          currency: account.currency || "USD",
          timezoneName: account.timezone_name || null,
          accountStatus: account.account_status ?? null,
          enabled: true,
        },
        update: {
          connection: {
            connect: { id: persistedConnection.id },
          },
          name: account.name || "Meta Ad Account " + metaAccountId,
          currency: account.currency || "USD",
          timezoneName: account.timezone_name || null,
          accountStatus: account.account_status ?? null,
          enabled: true,
        },
      });
    }

    return NextResponse.redirect(
      target(request, {
        connected: "1",
        accounts: String(adAccounts.length),
      })
    );
  } catch (error) {
    console.error("[MetaAds] OAuth callback failed:", error);
    return NextResponse.redirect(
      target(request, {
        error: error instanceof Error ? error.message : "Meta connection failed.",
      })
    );
  }
}
