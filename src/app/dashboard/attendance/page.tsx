"use client";

import { useEffect, useMemo, useState } from "react";

type AttendanceEvent = {
  id: string;
  eventType: string;
  eventTimeFormatted: string | null;
  durationMinutes?: number | null;
  isLate?: boolean;
  lateMinutes?: number;
};

type AttendanceViolation = {
  id: string;
  violationType: string;
  violationTimeFormatted: string | null;
  minutes: number;
  message: string;
};

type TodayAttendance = {
  id: string;
  status: "ON_TIME" | "LATE" | "ABSENT";
  lateMinutes: number;
  attendAtFormatted: string | null;
  workOffAtFormatted: string | null;
  lastEventType: string | null;
  events: AttendanceEvent[];
  violations: AttendanceViolation[];
};

type TodayResponse = {
  success: boolean;
  date: string;
  attendance: TodayAttendance | null;
  message?: string;
};

const actionLabels: Record<string, string> = {
  ATTEND: "Attend Work",
  BREAK_START: "Take Break",
  BREAK_END: "Back To Seat",
  EVENING_BREAK_START: "Evening Break",
  EVENING_BREAK_END: "Back To Seat",
  WORK_OFF: "Work Off",
};

function formatEventName(eventType: string) {
  return actionLabels[eventType] || eventType.replaceAll("_", " ");
}

export default function AttendancePage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "late" | "error" | null>(
    null
  );

  async function loadToday() {
    setLoading(true);

    try {
      const response = await fetch("/api/attendance/today", {
        cache: "no-store",
      });

      const result = await response.json();
      setData(result);
    } catch {
      setMessage("Failed to load attendance.");
      setAlertType("error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(action: string) {
    setActionLoading(action);
    setMessage(null);
    setAlertType(null);

    try {
      const response = await fetch("/api/attendance/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      setMessage(result.message || "Action completed.");
      setAlertType(result.alertType || (result.success ? "success" : "error"));

      await loadToday();
    } catch {
      setMessage("Something went wrong.");
      setAlertType("error");
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    loadToday();
  }, []);

  const attendance = data?.attendance || null;
  const lastEventType = attendance?.lastEventType || null;

  const buttonState = useMemo(() => {
    const hasAttend = Boolean(attendance?.attendAtFormatted);
    const hasWorkOff = Boolean(attendance?.workOffAtFormatted);

    const onNormalBreak = lastEventType === "BREAK_START";
    const onEveningBreak = lastEventType === "EVENING_BREAK_START";
    const onAnyBreak = onNormalBreak || onEveningBreak;

    return {
      canAttend: !hasAttend,
      canTakeBreak: hasAttend && !hasWorkOff && !onAnyBreak,
      canEndBreak: hasAttend && !hasWorkOff && onNormalBreak,
      canEveningBreak: hasAttend && !hasWorkOff && !onAnyBreak,
      canEndEveningBreak: hasAttend && !hasWorkOff && onEveningBreak,
      canWorkOff: hasAttend && !hasWorkOff && !onAnyBreak,
      hasWorkOff,
    };
  }, [attendance, lastEventType]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="mt-4 text-gray-500">Loading attendance...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-gray-500">
          Bangladesh Time • Attend time 09:00 AM • Grace period 5 minutes
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm font-medium ${
            alertType === "late"
              ? "border-red-300 bg-red-50 text-red-700"
              : alertType === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Date</p>
          <p className="mt-1 text-xl font-bold">{data?.date}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Attend Time</p>
          <p className="mt-1 text-xl font-bold">
            {attendance?.attendAtFormatted || "Not attended"}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Status</p>
          <p
            className={`mt-1 text-xl font-bold ${
              attendance?.status === "LATE" ? "text-red-600" : "text-green-600"
            }`}
          >
            {attendance?.status || "PENDING"}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Work Off</p>
          <p className="mt-1 text-xl font-bold">
            {attendance?.workOffAtFormatted || "Pending"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Today Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button
            disabled={!buttonState.canAttend || actionLoading !== null}
            onClick={() => submitAction("ATTEND")}
            className="rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "ATTEND" ? "Submitting..." : "Attend Work"}
          </button>

          <button
            disabled={!buttonState.canTakeBreak || actionLoading !== null}
            onClick={() => submitAction("BREAK_START")}
            className="rounded-lg bg-yellow-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "BREAK_START" ? "Submitting..." : "Take Break"}
          </button>

          <button
            disabled={!buttonState.canEndBreak || actionLoading !== null}
            onClick={() => submitAction("BREAK_END")}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "BREAK_END" ? "Submitting..." : "Back To Seat"}
          </button>

          <button
            disabled={!buttonState.canEveningBreak || actionLoading !== null}
            onClick={() => submitAction("EVENING_BREAK_START")}
            className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "EVENING_BREAK_START"
              ? "Submitting..."
              : "Evening Break"}
          </button>

          <button
            disabled={!buttonState.canEndEveningBreak || actionLoading !== null}
            onClick={() => submitAction("EVENING_BREAK_END")}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "EVENING_BREAK_END"
              ? "Submitting..."
              : "Back To Seat"}
          </button>

          <button
            disabled={!buttonState.canWorkOff || actionLoading !== null}
            onClick={() => submitAction("WORK_OFF")}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {actionLoading === "WORK_OFF" ? "Submitting..." : "Work Off"}
          </button>
        </div>

        {buttonState.hasWorkOff && (
          <p className="mt-4 text-sm font-medium text-green-700">
            Work closed for today.
          </p>
        )}
      </div>

      {attendance?.violations?.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="mb-3 text-lg font-semibold text-red-700">
            Today Violations
          </h2>

          <div className="space-y-2">
            {attendance.violations.map((violation) => (
              <div
                key={violation.id}
                className="rounded-lg border border-red-200 bg-white p-3 text-sm"
              >
                <p className="font-semibold text-red-700">
                  {violation.violationType.replaceAll("_", " ")}
                </p>
                <p>{violation.message}</p>
                <p className="text-gray-500">
                  Time: {violation.violationTimeFormatted}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Today History</h2>

        {!attendance?.events?.length ? (
          <p className="text-sm text-gray-500">No attendance history today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3">Action</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Late</th>
                </tr>
              </thead>

              <tbody>
                {attendance.events.map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="p-3 font-medium">
                      {formatEventName(event.eventType)}
                    </td>
                    <td className="p-3">{event.eventTimeFormatted}</td>
                    <td className="p-3">
                      {event.durationMinutes
                        ? `${event.durationMinutes} min`
                        : "-"}
                    </td>
                    <td className="p-3">
                      {event.isLate ? (
                        <span className="font-semibold text-red-600">
                          {event.lateMinutes} min late
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}