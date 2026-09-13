import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createPermanentPacket } from "@/lib/recruitment/pdf";
import { loadEmploymentPdfProfile } from "@/lib/recruitment/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });
  const { userId } = await context.params;
  const profile = await loadEmploymentPdfProfile(userId);
  if (!profile) return new NextResponse("Staff record not found", { status: 404 });
  if (!profile.permanentJoinDate) return new NextResponse("Staff is not permanently recruited yet", { status: 409 });
  const bytes = await createPermanentPacket(profile);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="permanent-${profile.user.username}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
