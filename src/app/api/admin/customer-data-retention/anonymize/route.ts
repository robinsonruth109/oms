import { NextResponse } from "next/server";

import {
  DELETED_ADDRESS,
  DELETED_CUSTOMER_NAME,
  DELETED_PHONE,
  getEligibleCustomerDataWhere,
} from "@/lib/customer-data-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestBody = {
  confirmation?: unknown;
  backupConfirmed?: unknown;
};

async function requireAdmin() {
  const [{ getServerSession }, { authOptions }] =
    await Promise.all([
      import("next-auth"),
      import("@/lib/auth"),
    ]);

  const session = await getServerSession(authOptions);

  return {
    isAdmin: session?.user?.role === "ADMIN",
    userId: session?.user?.id ?? null,
  };
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin.isAdmin) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request.",
      },
      { status: 400 }
    );
  }

  if (body.backupConfirmed !== true) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Confirm that you downloaded and checked the CSV backup first.",
      },
      { status: 400 }
    );
  }

  if (
    String(body.confirmation ?? "")
      .trim()
      .toUpperCase() !== "DELETE"
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Type DELETE to confirm.",
      },
      { status: 400 }
    );
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    const where = getEligibleCustomerDataWhere();

    const eligibleCount = await prisma.order.count({
      where,
    });

    if (eligibleCount === 0) {
      return NextResponse.json({
        success: true,
        anonymizedCount: 0,
        message:
          "There are no customer records older than the retention period that need anonymization.",
      });
    }

    const result = await prisma.order.updateMany({
      where,
      data: {
        customerName: DELETED_CUSTOMER_NAME,
        phone: DELETED_PHONE,
        address: DELETED_ADDRESS,

        // Free-text notes can contain delivery instructions or customer PII.
        note: null,

        // Old checkout idempotency tokens no longer need to remain attached
        // to customer records after the retention period.
        checkoutRequestId: null,

        // Preserve event/status/timestamps for aggregate audit, while
        // removing provider response/error bodies that may contain extra data.
        metaPurchaseError: null,
        metaPurchaseResponse: null,
      },
    });

    console.info(
      `[customer-data-retention] Admin ${admin.userId ?? "unknown"} manually anonymized ${result.count} order(s).`
    );

    return NextResponse.json({
      success: true,
      anonymizedCount: result.count,
      message: `${result.count} eligible order(s) were anonymized. Order and financial records were preserved.`,
    });
  } catch (error) {
    console.error(
      "Manual customer data anonymization failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Customer data could not be anonymized. No automatic retry will occur.",
      },
      { status: 500 }
    );
  }
}
