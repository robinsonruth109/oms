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

  const users = await prisma.user.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      attendances: {
        where: {
          attendanceDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          events: {
            orderBy: {
              eventTime: "asc",
            },
          },
          violations: {
            orderBy: {
              violationTime: "desc",
            },
          },
        },
      },
    },
  });

  const records = users.map((user) => {
    const attendance = user.attendances[0] || null;

    return {
      id: attendance?.id || `absent-${user.id}`,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
      status: attendance?.status || "ABSENT",
      lateMinutes: attendance?.lateMinutes || 0,
      attendAt: attendance?.attendAt || null,
      attendAtFormatted: formatBangladeshTime(attendance?.attendAt),
      workOffAt: attendance?.workOffAt || null,
      workOffAtFormatted: formatBangladeshTime(attendance?.workOffAt),
      events:
        attendance?.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          eventTime: event.eventTime,
          eventTimeFormatted: formatBangladeshTime(event.eventTime),
          durationMinutes: event.durationMinutes,
          isLate: event.isLate,
          lateMinutes: event.lateMinutes,
        })) || [],
      violations:
        attendance?.violations.map((violation) => ({
          id: violation.id,
          violationType: violation.violationType,
          violationTime: violation.violationTime,
          violationTimeFormatted: formatBangladeshTime(
            violation.violationTime
          ),
          minutes: violation.minutes,
          message: violation.message,
        })) || [],
    };
  });

  return NextResponse.json({
    success: true,
    date: dateKey,
    total: records.length,
    presentCount: records.filter((item) => item.status !== "ABSENT").length,
    absentCount: records.filter((item) => item.status === "ABSENT").length,
    lateCount: records.filter((item) => item.status === "LATE").length,
    violationCount: records.reduce(
      (sum, item) => sum + item.violations.length,
      0
    ),
    records,
  });
}