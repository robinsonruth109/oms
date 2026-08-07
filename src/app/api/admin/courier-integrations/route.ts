import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import {
  decryptCourierCredential,
  encryptCourierCredential,
  isCourierCredentialConfigured,
  serializeCourierCredential,
} from "@/lib/courier-score/credentials";
import { testCourierConnection } from "@/lib/courier-score/adapters/test-connection";
import { withDatabaseRetry } from "@/lib/database-retry";
import {
  COURIER_PROVIDERS,
  type CourierProvider,
} from "@/lib/courier-score/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  action?: unknown;
  provider?: unknown;
  enabled?: unknown;
  username?: unknown;
  password?: unknown;
  removeCredentials?: unknown;
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

function parseProvider(value: unknown): CourierProvider | null {
  if (typeof value !== "string") return null;
  return COURIER_PROVIDERS.includes(value as CourierProvider)
    ? (value as CourierProvider)
    : null;
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function listCredentials() {
  const { prisma } = await import("@/lib/prisma");
  const rows = await withDatabaseRetry(() =>
    prisma.courierCredential.findMany({
      where: { provider: { in: [...COURIER_PROVIDERS] } },
    })
  );
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return COURIER_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);

    if (!row) {
      return {
        provider,
        enabled: false,
        configured: false,
        usernameMasked: null,
        lastTestedAt: null,
        lastTestSuccess: null,
        lastTestMessage: null,
        updatedAt: null,
      };
    }

    return {
      ...serializeCourierCredential(row),
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestSuccess: row.lastTestSuccess,
      lastTestMessage: row.lastTestMessage,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function GET() {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, integrations: await listCredentials() });
  } catch (error) {
    console.error("Failed to load courier integrations:", error);
    return NextResponse.json(
      { success: false, message: "Courier integrations লোড করা যায়নি।" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const provider = parseProvider(body.provider);
    const enabled = parseBoolean(body.enabled);
    const username = text(body.username);
    const password = text(body.password);
    const removeCredentials = body.removeCredentials === true;

    if (!provider || enabled === null) {
      return NextResponse.json({ success: false, message: "Courier settings সঠিক নয়।" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const existing = await withDatabaseRetry(() =>
      prisma.courierCredential.findUnique({ where: { provider } })
    );

    const configured = existing ? isCourierCredentialConfigured(existing) : false;
    if (enabled && !configured && (!username || !password)) {
      return NextResponse.json(
        { success: false, message: `${provider} enable করতে username এবং password লিখুন।` },
        { status: 400 }
      );
    }

    const credentialUpdate: {
      usernameEncrypted?: string | null;
      usernameIv?: string | null;
      usernameTag?: string | null;
      passwordEncrypted?: string | null;
      passwordIv?: string | null;
      passwordTag?: string | null;
    } = {};

    if (removeCredentials) {
      credentialUpdate.usernameEncrypted = null;
      credentialUpdate.usernameIv = null;
      credentialUpdate.usernameTag = null;
      credentialUpdate.passwordEncrypted = null;
      credentialUpdate.passwordIv = null;
      credentialUpdate.passwordTag = null;
    } else if (username || password) {
      if (!username || !password) {
        return NextResponse.json(
          { success: false, message: "Username এবং password দুটোই একসাথে লিখুন।" },
          { status: 400 }
        );
      }

      Object.assign(
        credentialUpdate,
        encryptCourierCredential({ provider, enabled, username, password })
      );
    }

    const saved = await withDatabaseRetry(() =>
      prisma.courierCredential.upsert({
        where: { provider },
        create: {
          provider,
          enabled: removeCredentials ? false : enabled,
          ...credentialUpdate,
        },
        update: {
          enabled: removeCredentials ? false : enabled,
          ...credentialUpdate,
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: `${provider} settings সংরক্ষণ করা হয়েছে।`,
      integration: {
        ...serializeCourierCredential(saved),
        lastTestedAt: saved.lastTestedAt?.toISOString() ?? null,
        lastTestSuccess: saved.lastTestSuccess,
        lastTestMessage: saved.lastTestMessage,
        updatedAt: saved.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to save courier integration:", error);
    const message =
      error instanceof Error && error.message.includes("SHOP_SETTINGS_ENCRYPTION_KEY")
        ? "SHOP_SETTINGS_ENCRYPTION_KEY configure না করলে courier credentials save করা যাবে না।"
        : "Courier settings সংরক্ষণ করা যায়নি।";

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminRole(await getCurrentUserRole())) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    if (body.action !== "testConnection") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    const provider = parseProvider(body.provider);
    if (!provider) {
      return NextResponse.json({ success: false, message: "Courier provider সঠিক নয়।" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const row = await withDatabaseRetry(() =>
      prisma.courierCredential.findUnique({ where: { provider } })
    );

    const enteredUsername = text(body.username);
    const enteredPassword = text(body.password);

    let username = enteredUsername;
    let password = enteredPassword;

    if (!username && !password) {
      if (!row || !isCourierCredentialConfigured(row)) {
        return NextResponse.json(
          { success: false, message: `${provider} credentials আগে save করুন।` },
          { status: 400 }
        );
      }

      const decrypted = decryptCourierCredential(row);
      username = decrypted.username;
      password = decrypted.password;
    } else if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Test করতে username এবং password দুটোই লিখুন।" },
        { status: 400 }
      );
    }

    const result = await testCourierConnection({ provider, username, password });
    const testedAt = new Date();

    const saved = await withDatabaseRetry(() =>
      prisma.courierCredential.upsert({
        where: { provider },
        create: {
          provider,
          enabled: false,
          lastTestedAt: testedAt,
          lastTestSuccess: result.success,
          lastTestMessage: result.message.slice(0, 4000),
        },
        update: {
          lastTestedAt: testedAt,
          lastTestSuccess: result.success,
          lastTestMessage: result.message.slice(0, 4000),
        },
      })
    );

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        integration: {
          ...serializeCourierCredential(saved),
          lastTestedAt: testedAt.toISOString(),
          lastTestSuccess: result.success,
          lastTestMessage: result.message,
          updatedAt: saved.updatedAt.toISOString(),
        },
      },
      { status: result.success ? 200 : 400 }
    );
  } catch (error) {
    console.error("Courier connection test failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Courier connection test failed.",
      },
      { status: 500 }
    );
  }
}
