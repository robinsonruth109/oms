import { NextRequest, NextResponse } from "next/server";
import { loadStorefrontPage } from "@/lib/storefront";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const revalidate = 0;
function readLimit(value: string | null) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(24, Math.max(1, Math.trunc(parsed))) : 12; }
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try { const { slug } = await context.params; const categorySlug = decodeURIComponent(slug).trim().toLowerCase(); const page = await loadStorefrontPage({ categorySlug, cursor: request.nextUrl.searchParams.get("cursor"), limit: readLimit(request.nextUrl.searchParams.get("limit")) }); return NextResponse.json({ success: true, ...page }); }
  catch (error) { console.error("Failed to load collection products:", error); return NextResponse.json({ success:false, message:"পণ্যগুলো এখন লোড করা যাচ্ছে না।" }, { status:503 }); }
}
