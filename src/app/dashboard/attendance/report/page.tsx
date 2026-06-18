"use client";

import { Fragment, useEffect, useState } from "react";

type AttendanceEvent = {
  id: string;
  eventType: string;
  eventTimeFormatted: string | null;
  durationMinutes: number | null;
  isLate: boolean;
  lateMinutes: number;
};

type AttendanceRecord = {
  id: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    role: string;
  };
  status: string;
  lateMinutes: number;
  attendAtFormatted: string | null;
  workOffAtFormatted: string | null;
  events: AttendanceEvent[];
  violations: {
    id: string;
    violationType: string;
    message: string;
    minutes: number;
    violationTimeFormatted: string | null;
  }[];
};

function formatEventName(eventType: string) {
  const names: Record<string, string> = {
    ATTEND: "Attend Work",
    BREAK_START: "Take Break",
    BREAK_END: "Back To Seat",
    EVENING_BREAK_START: "Evening Break",
    EVENING_BREAK_END: "Back To Seat",
    WORK_OFF: "Work Off",
  };

  return names[eventType] || eventType.replaceAll("_", " ");
}

export default function AttendanceReportPage() {
  const [date, setDate] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    total: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    violationCount: 0,
  });
  const [loading, setLoading] = useState(true);

  async function loadReport(selectedDate?: string) {
    setLoading(true);

    try {
      const query = selectedDate ? `?date=${selectedDate}` : "";

      const response = await fetch(`/api/attendance/admin/daily${query}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (result.success) {
        setDate(result.date);
        setRecords(result.records || []);
        setSummary({
          total: result.total || 0,
          presentCount: result.presentCount || 0,
          absentCount: result.absentCount || 0,
          lateCount: result.lateCount || 0,
          violationCount: result.violationCount || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Daily Report</h1>
        <p className="text-sm text-gray-500">
          Admin report for daily attendance and full worker activity history.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={() => loadReport(date)}
          className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="mt-1 text-2xl font-bold">{summary.total}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Present</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {summary.presentCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Absent</p>
          <p className="mt-1 text-2xl font-bold text-gray-600">
            {summary.absentCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Late</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {summary.lateCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Violations</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">
            {summary.violationCount}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Daily Records</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading report...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500">No attendance record found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Attend</th>
                  <th className="p-3">Work Off</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Late</th>
                  <th className="p-3">Violations</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <Fragment key={record.id}>
                    <tr className="border-b">
                      <td className="p-3">
                        <button
                          onClick={() =>
                            setExpandedUser(
                              expandedUser === record.user.id
                                ? null
                                : record.user.id
                            )
                          }
                          className="text-left font-semibold hover:text-blue-600"
                        >
                          {expandedUser === record.user.id ? "▼" : "▶"}{" "}
                          {record.user.name || record.user.username}
                        </button>
                        <p className="text-xs text-gray-500">
                          @{record.user.username}
                        </p>
                      </td>

                      <td className="p-3">{record.user.role}</td>
                      <td className="p-3">{record.attendAtFormatted || "-"}</td>
                      <td className="p-3">
                        {record.workOffAtFormatted || "-"}
                      </td>

                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            record.status === "LATE"
                              ? "bg-red-100 text-red-700"
                              : record.status === "ABSENT"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {record.lateMinutes > 0
                          ? `${record.lateMinutes} min`
                          : "-"}
                      </td>

                      <td className="p-3">
                        {record.violations.length === 0 ? (
                          "-"
                        ) : (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            {record.violations.length} violation
                          </span>
                        )}
                      </td>
                    </tr>

                    {expandedUser === record.user.id && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 p-4">
                          <div className="rounded-xl border bg-white p-4">
                            <h3 className="mb-3 text-base font-semibold">
                              Attendance History
                            </h3>

                            {record.events.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                No activity history found for this user.
                              </p>
                            ) : (
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="border-b bg-gray-50 text-left">
                                    <th className="p-2">Action</th>
                                    <th className="p-2">Time</th>
                                    <th className="p-2">Duration</th>
                                    <th className="p-2">Late</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {record.events.map((event) => (
                                    <tr key={event.id} className="border-b">
                                      <td className="p-2 font-medium">
                                        {formatEventName(event.eventType)}
                                      </td>
                                      <td className="p-2">
                                        {event.eventTimeFormatted || "-"}
                                      </td>
                                      <td className="p-2">
                                        {event.durationMinutes
                                          ? `${event.durationMinutes} min`
                                          : "-"}
                                      </td>
                                      <td className="p-2">
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
                            )}

                            {record.violations.length > 0 && (
                              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                                <h4 className="mb-2 font-semibold text-red-700">
                                  Violations
                                </h4>

                                <div className="space-y-2">
                                  {record.violations.map((violation) => (
                                    <div
                                      key={violation.id}
                                      className="rounded-md bg-white p-2 text-sm text-red-700"
                                    >
                                      <p className="font-semibold">
                                        {violation.violationType.replaceAll(
                                          "_",
                                          " "
                                        )}
                                      </p>
                                      <p>{violation.message}</p>
                                      <p className="text-xs text-gray-500">
                                        Time:{" "}
                                        {violation.violationTimeFormatted ||
                                          "-"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}