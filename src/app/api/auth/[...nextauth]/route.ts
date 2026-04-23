import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getHandler() {
  const NextAuth = (await import("next-auth")).default;
  const { authOptions } = await import("@/lib/auth");
  return NextAuth(authOptions);
}

export async function GET(request: NextRequest, context: any) {
  const handler = await getHandler();
  return handler(request, context);
}

export async function POST(request: NextRequest, context: any) {
  const handler = await getHandler();
  return handler(request, context);
}