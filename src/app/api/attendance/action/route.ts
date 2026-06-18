import { NextRequest, NextResponse } from "next/server";
import { AttendanceEventType, AttendanceStatus, AttendanceViolationType } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BD_TIMEZONE = "Asia/Dhaka";

const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 0;
const ATTEND_GRACE_MINUTES = 5;
const EVENING_BREAK_ALLOWED_MINUTES = 30;

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

function getBangladeshOfficeStart(date = new Date()) {
  const dateKey = getBangladeshDateKey(date);

  return new Date(
    `${dateKey}T${String(OFFICE_START_HOUR).padStart(2, "0")}:${String(
      OFFICE_START_MINUTE
    ).padStart(2, "0")}:00+06:00`
  );
}

function diffMinutes(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 60000));
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

async function getOrCreateTodayAttendance(userId: string, now: Date) {
  const { start, end } = getBangladeshDayRange(now);

  const existing = await prisma.attendance.findFirst({
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
      violations: true,
    },
  });

  if (existing) return existing;

  return prisma.attendance.create({
    data: {
      userId,
      attendanceDate: start,
      status: AttendanceStatus.ON_TIME,
    },
    include: {
      events: {
        orderBy: {
          eventTime: "asc",
        },
      },
      violations: true,
    },
  });
}

async function createViolation(params: {
  attendanceId: string;
  userId: string;
  violationType: AttendanceViolationType;
  minutes: number;
  message: string;
  violationTime: Date;
}) {
  const existing = await prisma.attendanceViolation.findFirst({
    where: {
      attendanceId: params.attendanceId,
      userId: params.userId,
      violationType: params.violationType,
    },
  });

  if (existing) return existing;

  return prisma.attendanceViolation.create({
    data: {
      attendanceId: params.attendanceId,
      userId: params.userId,
      violationType: params.violationType,
      minutes: params.minutes,
      message: params.message,
      violationTime: params.violationTime,
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as
    | "ATTEND"
    | "BREAK_START"
    | "BREAK_END"
    | "EVENING_BREAK_START"
    | "EVENING_BREAK_END"
    | "WORK_OFF"
    | undefined;

  if (!action) {
    return NextResponse.json(
      { success: false, message: "Action is required" },
      { status: 400 }
    );
  }

  const now = new Date();
  const attendance = await getOrCreateTodayAttendance(userId, now);
  const lastEvent = attendance.events[attendance.events.length - 1] || null;

  if (action === "ATTEND") {
    if (attendance.attendAt) {
      return NextResponse.json(
        { success: false, message: "You already attended today." },
        { status: 400 }
      );
    }

    const officeStart = getBangladeshOfficeStart(now);
    const lateAfter = new Date(
      officeStart.getTime() + ATTEND_GRACE_MINUTES * 60000
    );

    const isLate = now.getTime() > lateAfter.getTime();
    const lateMinutes = isLate ? diffMinutes(now, lateAfter) : 0;

    const updated = await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        attendAt: now,
        status: isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
        lateMinutes,
        events: {
          create: {
            userId,
            eventType: AttendanceEventType.ATTEND,
            eventTime: now,
            isLate,
            lateMinutes,
          },
        },
      },
      include: {
        events: {
          orderBy: {
            eventTime: "asc",
          },
        },
        violations: true,
      },
    });

    if (isLate) {
      await createViolation({
        attendanceId: attendance.id,
        userId,
        violationType: AttendanceViolationType.LATE_ATTENDANCE,
        minutes: lateMinutes,
        message: `You are late in work by ${lateMinutes} minute(s).`,
        violationTime: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: isLate
        ? `You are late in work by ${lateMinutes} minute(s).`
        : "Attendance submitted successfully.",
      alertType: isLate ? "late" : "success",
      attendance: updated,
      timeFormatted: formatBangladeshTime(now),
    });
  }

  if (!attendance.attendAt) {
    return NextResponse.json(
      { success: false, message: "Please attend work first." },
      { status: 400 }
    );
  }

  if (attendance.workOffAt && action !== "WORK_OFF") {
    return NextResponse.json(
      { success: false, message: "Work already closed for today." },
      { status: 400 }
    );
  }

  if (action === "BREAK_START") {
    if (
      lastEvent?.eventType === AttendanceEventType.BREAK_START ||
      lastEvent?.eventType === AttendanceEventType.EVENING_BREAK_START
    ) {
      return NextResponse.json(
        { success: false, message: "You are already on break." },
        { status: 400 }
      );
    }

    await prisma.attendanceEvent.create({
      data: {
        attendanceId: attendance.id,
        userId,
        eventType: AttendanceEventType.BREAK_START,
        eventTime: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Break started.",
      timeFormatted: formatBangladeshTime(now),
    });
  }

  if (action === "BREAK_END") {
    if (lastEvent?.eventType !== AttendanceEventType.BREAK_START) {
      return NextResponse.json(
        { success: false, message: "No active normal break found." },
        { status: 400 }
      );
    }

    const durationMinutes = diffMinutes(now, lastEvent.eventTime);

    await prisma.attendanceEvent.create({
      data: {
        attendanceId: attendance.id,
        userId,
        eventType: AttendanceEventType.BREAK_END,
        eventTime: now,
        durationMinutes,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Back to seat. Break duration ${durationMinutes} minute(s).`,
      timeFormatted: formatBangladeshTime(now),
    });
  }

  if (action === "EVENING_BREAK_START") {
    if (
      lastEvent?.eventType === AttendanceEventType.BREAK_START ||
      lastEvent?.eventType === AttendanceEventType.EVENING_BREAK_START
    ) {
      return NextResponse.json(
        { success: false, message: "You are already on break." },
        { status: 400 }
      );
    }

    await prisma.attendanceEvent.create({
      data: {
        attendanceId: attendance.id,
        userId,
        eventType: AttendanceEventType.EVENING_BREAK_START,
        eventTime: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Evening break started. Allowed time: 30 minutes.",
      timeFormatted: formatBangladeshTime(now),
    });
  }

  if (action === "EVENING_BREAK_END") {
    if (lastEvent?.eventType !== AttendanceEventType.EVENING_BREAK_START) {
      return NextResponse.json(
        { success: false, message: "No active evening break found." },
        { status: 400 }
      );
    }

    const durationMinutes = diffMinutes(now, lastEvent.eventTime);
    const isLate = durationMinutes > EVENING_BREAK_ALLOWED_MINUTES;
    const lateMinutes = isLate
      ? durationMinutes - EVENING_BREAK_ALLOWED_MINUTES
      : 0;

    await prisma.attendanceEvent.create({
      data: {
        attendanceId: attendance.id,
        userId,
        eventType: AttendanceEventType.EVENING_BREAK_END,
        eventTime: now,
        durationMinutes,
        isLate,
        lateMinutes,
      },
    });

    if (isLate) {
      await createViolation({
        attendanceId: attendance.id,
        userId,
        violationType: AttendanceViolationType.EVENING_BREAK_OVERSTAY,
        minutes: lateMinutes,
        message: `Evening break late by ${lateMinutes} minute(s).`,
        violationTime: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: isLate
        ? `Evening break late by ${lateMinutes} minute(s).`
        : `Back to seat. Evening break duration ${durationMinutes} minute(s).`,
      alertType: isLate ? "late" : "success",
      timeFormatted: formatBangladeshTime(now),
    });
  }

  if (action === "WORK_OFF") {
    if (attendance.workOffAt) {
      return NextResponse.json(
        { success: false, message: "Work already closed today." },
        { status: 400 }
      );
    }

    if (
      lastEvent?.eventType === AttendanceEventType.BREAK_START ||
      lastEvent?.eventType === AttendanceEventType.EVENING_BREAK_START
    ) {
      return NextResponse.json(
        { success: false, message: "Please back to seat before work off." },
        { status: 400 }
      );
    }

    await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        workOffAt: now,
        events: {
          create: {
            userId,
            eventType: AttendanceEventType.WORK_OFF,
            eventTime: now,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Work off submitted successfully.",
      timeFormatted: formatBangladeshTime(now),
    });
  }

  return NextResponse.json(
    { success: false, message: "Invalid action" },
    { status: 400 }
  );
}