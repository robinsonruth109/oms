"use client";

import { useState, useTransition } from "react";
import { createDollarRate, deleteDollarRate } from "./actions";

type GroupedRate = {
  date: string;
  totalUsd: number;
  totalBdt: number;
  averageRate: number;
  entries: {
    id: string;
    rateDate: string;
    usdAmount: number;
    bdtAmount: number;
    usdRate: number;
    note: string | null;
  }[];
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function formatUsd(value: number) {
  return `$ ${value.toFixed(2)}`;
}

export default function DollarRatesClient({
  from,
  to,
  groupedRates,
}: {
  from: string;
  to: string;
  groupedRates: GroupedRate[];
}) {
  const [pending, startTransition] = useTransition();

  const [message, setMessage] = useState("");

  const [rateDate, setRateDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [usdAmount, setUsdAmount] = useState(1);
  const [bdtAmount, setBdtAmount] = useState(0);
  const [note, setNote] = useState("");

  const usdRate = usdAmount > 0 ? bdtAmount / usdAmount : 0;

  async function handleSubmit() {
    setMessage("");

    startTransition(async () => {
      const result = await createDollarRate({
        rateDate,
        usdAmount,
        bdtAmount,
        note,
      });

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    });
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this entry?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteDollarRate(id);

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Add Dollar Purchase
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Input
            label="Date"
            type="date"
            value={rateDate}
            onChange={setRateDate}
          />

          <NumberInput
            label="USD Amount"
            value={usdAmount}
            onChange={setUsdAmount}
          />

          <NumberInput
            label="BDT Amount"
            value={bdtAmount}
            onChange={setBdtAmount}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Dollar Rate
            </label>

            <div className="rounded-xl border bg-slate-100 px-3 py-2.5 text-sm font-semibold">
              ৳ {usdRate.toFixed(2)}
            </div>
          </div>

          <Input
            label="Note"
            value={note}
            onChange={setNote}
          />
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm">
            {message}
          </div>
        ) : null}

        <div className="mt-6">
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmit}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Dollar Rate"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Average Dollar Rates
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Date</Th>
                <Th center>Total USD</Th>
                <Th center>Total BDT</Th>
                <Th center>Average Rate</Th>
                <Th center>Entries</Th>
              </tr>
            </thead>

            <tbody>
              {groupedRates.map((group) => (
                <tr key={group.date} className="border-b align-top">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                    {group.date}
                  </td>

                  <Td center>{formatUsd(group.totalUsd)}</Td>

                  <Td center>{formatMoney(group.totalBdt)}</Td>

                  <Td center>
                    <span className="font-semibold">
                      ৳ {group.averageRate.toFixed(2)}
                    </span>
                  </Td>

                  <td className="px-5 py-4">
                    <div className="space-y-3">
                      {group.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border bg-slate-50 p-3"
                        >
                          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                            <div>
                              <p className="text-slate-400">USD</p>
                              <p className="font-medium">
                                {formatUsd(entry.usdAmount)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">BDT</p>
                              <p className="font-medium">
                                {formatMoney(entry.bdtAmount)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">Rate</p>
                              <p className="font-medium">
                                ৳ {entry.usdRate.toFixed(2)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">Note</p>
                              <p className="font-medium">
                                {entry.note || "-"}
                              </p>
                            </div>

                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {!groupedRates.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No dollar rate entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  name?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        name={name}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      />
    </div>
  );
}

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-sm text-slate-700 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}