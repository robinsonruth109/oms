import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function getBangladeshDayRange(date = new Date()) {
  const dateKey = getBangladeshDateKey(date);
  const start = new Date(`${dateKey}T00:00:00+06:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { dateKey, start, end };
}

function formatBangladeshTime(date: Date | null) {
  if (!date) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);

  const userId =
    (session?.user as { id?: string } | undefined)?.id ||
    (session as { userId?: string } | null)?.userId;

  return userId || null;
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { start, end, dateKey } = getBangladeshDayRange();

  const attendance = await prisma.attendance.findFirst({
    where: {
      userId,
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
  });

  const lastEvent = attendance?.events?.[attendance.events.length - 1] || null;

  return NextResponse.json({
    success: true,
    date: dateKey,
    attendance: attendance
      ? {
          id: attendance.id,
          status: attendance.status,
          lateMinutes: attendance.lateMinutes,
          attendAt: attendance.attendAt,
          attendAtFormatted: formatBangladeshTime(attendance.attendAt),
          workOffAt: attendance.workOffAt,
          workOffAtFormatted: formatBangladeshTime(attendance.workOffAt),
          lastEventType: lastEvent?.eventType || null,
          events: attendance.events.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            eventTime: event.eventTime,
            eventTimeFormatted: formatBangladeshTime(event.eventTime),
            durationMinutes: event.durationMinutes,
            isLate: event.isLate,
            lateMinutes: event.lateMinutes,
          })),
          violations: attendance.violations.map((violation) => ({
            id: violation.id,
            violationType: violation.violationType,
            violationTime: violation.violationTime,
            violationTimeFormatted: formatBangladeshTime(
              violation.violationTime
            ),
            minutes: violation.minutes,
            message: violation.message,
          })),
        }
      : null,
  });
}