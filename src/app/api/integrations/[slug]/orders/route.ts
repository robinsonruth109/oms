import { NextRequest, NextResponse } from "next/server";
import type { IncomingIntegrationOrder } from "@/lib/integration-order-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as IncomingIntegrationOrder;

    const { importIntegrationOrderBySlug } = await import(
      "@/lib/integration-order-import"
    );

    const result = await importIntegrationOrderBySlug(slug, body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        orderId: result.orderId,
        message: result.message,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body or server error.",
      },
      { status: 500 }
    );
  }
}