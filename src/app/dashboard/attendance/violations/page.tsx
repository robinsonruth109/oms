"use client";

import { useEffect, useState } from "react";

type ViolationRecord = {
  id: string;
  user: {
    name: string | null;
    username: string;
    role: string;
  };
  violationType: string;
  violationTimeFormatted: string | null;
  minutes: number;
  message: string;
  attendance: {
    status: string;
    lateMinutes: number;
    attendAtFormatted: string | null;
    workOffAtFormatted: string | null;
  };
};

export default function AttendanceViolationsPage() {
  const [date, setDate] = useState("");
  const [records, setRecords] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadViolations(selectedDate?: string) {
    setLoading(true);

    const query = selectedDate ? `?date=${selectedDate}` : "";

    try {
      const response = await fetch(`/api/attendance/admin/violations${query}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (result.success) {
        setDate(result.date);
        setRecords(result.records || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadViolations();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Violations</h1>
        <p className="text-sm text-gray-500">
          Admin can view late attendance and break rule violations.
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
          onClick={() => loadViolations(date)}
          className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Violation List</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading violations...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500">No violation found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Violation</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Minutes</th>
                  <th className="p-3">Attend</th>
                  <th className="p-3">Work Off</th>
                  <th className="p-3">Message</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-3">
                      <p className="font-semibold">
                        {record.user.name || record.user.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        @{record.user.username} • {record.user.role}
                      </p>
                    </td>

                    <td className="p-3">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        {record.violationType.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="p-3">
                      {record.violationTimeFormatted || "-"}
                    </td>

                    <td className="p-3 font-semibold text-red-600">
                      {record.minutes} min
                    </td>

                    <td className="p-3">
                      {record.attendance.attendAtFormatted || "-"}
                    </td>

                    <td className="p-3">
                      {record.attendance.workOffAtFormatted || "-"}
                    </td>

                    <td className="p-3">{record.message}</td>
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