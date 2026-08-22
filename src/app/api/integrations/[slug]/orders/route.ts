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
      console.error("Integration order rejected:", {
        slug,
        externalOrderId: body?.externalOrderId,
        invoiceId: body?.invoiceId,
        status: result.status,
        message: result.message,
      });

      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        {
          status: result.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        orderId: result.orderId,
        message: result.message,
        warnings: result.warnings || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Integration request body/server error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Invalid request body or temporary server error. Retry the request.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
