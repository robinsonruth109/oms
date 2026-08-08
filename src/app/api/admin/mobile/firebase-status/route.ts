import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  getFirebaseAdminApp,
  verifyFirebaseAdminCredentials,
} from "@/lib/firebase-admin";
import { getFirebaseConfigurationStatus } from "@/lib/firebase-server-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const status = getFirebaseConfigurationStatus();

  if (!status.configured) {
    return NextResponse.json(
      {
        ok: false,
        firebase: {
          configured: false,
          initialized: false,
          credentialsVerified: false,
          projectIdConfigured: status.projectIdConfigured,
          clientEmailConfigured: status.clientEmailConfigured,
          privateKeyConfigured: status.privateKeyConfigured,
          privateKeyLooksValid: status.privateKeyLooksValid,
          projectId: status.projectId,
          clientEmail: status.clientEmail,
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const app = getFirebaseAdminApp();
    const verifyCredentials =
      request.nextUrl.searchParams.get("verify") === "1";

    const verification = verifyCredentials
      ? await verifyFirebaseAdminCredentials()
      : {
          initialized: true,
          credentialsVerified: false,
          projectId: app.options.projectId ?? null,
        };

    return NextResponse.json(
      {
        ok: true,
        firebase: {
          configured: true,
          initialized: verification.initialized,
          credentialsVerified: verification.credentialsVerified,
          projectIdConfigured: true,
          clientEmailConfigured: true,
          privateKeyConfigured: true,
          privateKeyLooksValid: true,
          projectId: verification.projectId ?? status.projectId,
          clientEmail: status.clientEmail,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Firebase Admin initialization failed.",
        firebase: {
          configured: true,
          initialized: false,
          credentialsVerified: false,
          projectId: status.projectId,
          clientEmail: status.clientEmail,
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
