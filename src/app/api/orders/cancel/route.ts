import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");

    const body = await req.json();

    const orderId = String(body.orderId || "").trim();

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Order ID is required." },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        orderStatus: "CANCELLED",
        calledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to cancel order.",
      },
      { status: 500 }
    );
  }
}