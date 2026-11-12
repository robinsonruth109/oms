"use client";

import { useState } from "react";

import { addSalaryTransactionAction } from "../../actions";

type Props = {
  userId: string;
  selectedMonth: string;
  today: string;
};

export default function PayAgentForm({ userId, selectedMonth, today }: Props) {
  const [type, setType] = useState("ADVANCE_SALARY");

  return (
    <form action={addSalaryTransactionAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="month" value={selectedMonth} />

      <label>
        <span className="mb-1 block text-sm font-medium">Payment Type</span>
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="min-h-11 w-full rounded-xl border px-3 text-sm"
        >
          <option value="ADVANCE_SALARY">Advance Salary</option>
          <option value="PARTIAL_SALARY">Partial Salary</option>
          <option value="LIABILITY_PAYMENT">Pay Liability</option>
        </select>
      </label>

      <label>
        <span className="mb-1 block text-sm font-medium">Amount</span>
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          className="min-h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>

      {type === "ADVANCE_SALARY" ? (
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Salary Month to Deduct From</span>
          <input
            name="advanceMonth"
            type="month"
            defaultValue={selectedMonth}
            required
            className="min-h-11 w-full rounded-xl border px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            This advance will reduce the salary balance of this selected month only.
          </span>
        </label>
      ) : null}

      <label>
        <span className="mb-1 block text-sm font-medium">Date</span>
        <input
          name="transactionDate"
          type="date"
          defaultValue={today}
          required
          className="min-h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>

      <label>
        <span className="mb-1 block text-sm font-medium">Note</span>
        <input
          name="note"
          className="min-h-11 w-full rounded-xl border px-3 text-sm"
          placeholder="Optional note"
        />
      </label>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 sm:col-span-2">
        Payment source: <strong>Cash</strong>. Advance Salary is deducted from the salary month you select above.
      </div>

      <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white sm:col-span-2">
        Record Payment
      </button>
    </form>
  );
}
