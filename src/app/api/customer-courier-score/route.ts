import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import {
  checkCustomerCourierScore,
  getCachedCourierScore,
} from "@/lib/courier-score/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  phone?: unknown;
  action?: unknown;
};

async function hasAuthenticatedSession() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  return Boolean(session?.user);
}

export async function POST(request: NextRequest) {
  try {
    if (!(await hasAuthenticatedSession())) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const action = body.action === "refresh" ? "refresh" : "cache";

    if (action === "cache") {
      const score = await getCachedCourierScore(body.phone);
      return NextResponse.json({ success: true, score, cached: Boolean(score) });
    }

    const score = await checkCustomerCourierScore(body.phone, { forceRefresh: true });
    return NextResponse.json({ success: true, score, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Courier score check failed.";
    const badPhone = message.includes("১১ সংখ্যার বাংলাদেশি মোবাইল");

    return NextResponse.json(
      { success: false, message },
      { status: badPhone ? 400 : 502 }
    );
  }
}
