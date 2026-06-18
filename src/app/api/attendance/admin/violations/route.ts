import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BD_TIMEZONE = "Asia/Dhaka";

function getBangladeshDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getBangladeshDayRangeFromDateKey(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+06:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function formatBangladeshTime(date: Date | null | undefined) {
  if (!date) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

async function getCurrentUserRole() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  const role =
    (session?.user as { role?: string } | undefined)?.role ||
    (session as { role?: string } | null)?.role;

  return role || null;
}

function isAdminRole(role: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET(request: NextRequest) {
  const { prisma } = await import("@/lib/prisma");

  const role = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const dateKey = searchParams.get("date") || getBangladeshDateKey();
  const { start, end } = getBangladeshDayRangeFromDateKey(dateKey);

  const violations = await prisma.attendanceViolation.findMany({
    where: {
      violationTime: {
        gte: start,
        lt: end,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
      attendance: {
        select: {
          attendanceDate: true,
          attendAt: true,
          workOffAt: true,
          status: true,
          lateMinutes: true,
        },
      },
    },
    orderBy: {
      violationTime: "desc",
    },
  });

  return NextResponse.json({
    success: true,
    date: dateKey,
    total: violations.length,
    records: violations.map((item) => ({
      id: item.id,
      user: item.user,
      violationType: item.violationType,
      violationTime: item.violationTime,
      violationTimeFormatted: formatBangladeshTime(item.violationTime),
      minutes: item.minutes,
      message: item.message,
      attendance: {
        ...item.attendance,
        attendAtFormatted: formatBangladeshTime(item.attendance?.attendAt),
        workOffAtFormatted: formatBangladeshTime(item.attendance?.workOffAt),
      },
    })),
  });
}