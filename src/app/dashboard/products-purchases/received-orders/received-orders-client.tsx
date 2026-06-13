"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { createReceivedOrder } from "./actions";

type Row = {
  id: string;
  invoiceNo: string;
  productSku: string;
  productName: string;
  parentSku: string;
  orderedQty: number;
  quantityType: string;
  paidAmountBdt: number;
  receivedQty: number;
  remainingQty: number;
  totalGrandBdt: number;
  averageOriginalPrice: number;
  status: string;
};

type FormState = {
  receiveDate: string;
  receivedQty: number;
  packageWeight: number;
  cnfRatePerKg: number;
  otherCostBdt: number;
  note: string;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "RECEIVED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "PARTIAL_RECEIVED"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {status}
    </span>
  );
}

function defaultForm(row: Row): FormState {
  return {
    receiveDate: todayInput(),
    receivedQty: row.remainingQty > 0 ? row.remainingQty : 0,
    packageWeight: 0,
    cnfRatePerKg: 0,
    otherCostBdt: 0,
    note: "",
  };
}

export default function ReceivedOrdersClient({ rows }: { rows: Row[] }) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [formMap, setFormMap] = useState<Record<string, FormState>>({});
  const [messageMap, setMessageMap] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const groupedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        parentSku: string;
        totalOrders: number;
        orderedQty: number;
        receivedQty: number;
        remainingQty: number;
        totalGrandBdt: number;
        averageOriginalPrice: number;
        orders: Row[];
      }
    >();

    for (const row of rows) {
      const existing = map.get(row.parentSku);

      if (existing) {
        existing.totalOrders += 1;
        existing.orderedQty += row.orderedQty;
        existing.receivedQty += row.receivedQty;
        existing.remainingQty += row.remainingQty;
        existing.totalGrandBdt += row.totalGrandBdt;
        existing.orders.push(row);
        existing.averageOriginalPrice =
          existing.receivedQty > 0
            ? existing.totalGrandBdt / existing.receivedQty
            : 0;
      } else {
        map.set(row.parentSku, {
          parentSku: row.parentSku,
          totalOrders: 1,
          orderedQty: row.orderedQty,
          receivedQty: row.receivedQty,
          remainingQty: row.remainingQty,
          totalGrandBdt: row.totalGrandBdt,
          averageOriginalPrice: row.averageOriginalPrice,
          orders: [row],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalGrandBdt - a.totalGrandBdt
    );
  }, [rows]);

  function toggle(key: string) {
    setOpenRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function getForm(row: Row) {
    return formMap[row.id] || defaultForm(row);
  }

  function updateForm(row: Row, patch: Partial<FormState>) {
    setFormMap((prev) => ({
      ...prev,
      [row.id]: {
        ...(prev[row.id] || defaultForm(row)),
        ...patch,
      },
    }));
  }

  function saveReceive(row: Row) {
    const form = getForm(row);

    setPendingId(row.id);
    setMessageMap((prev) => ({ ...prev, [row.id]: "" }));

    startTransition(async () => {
      const result = await createReceivedOrder({
        purchaseOrderId: row.id,
        receiveDate: form.receiveDate,
        receivedQty: form.receivedQty,
        packageWeight: form.packageWeight,
        cnfRatePerKg: form.cnfRatePerKg,
        otherCostBdt: form.otherCostBdt,
        note: form.note,
      });

      setPendingId(null);
      setMessageMap((prev) => ({ ...prev, [row.id]: result.message }));

      if (result.success) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Received Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Receive paid purchase orders and calculate original product cost with CNF and other costing.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary title="Paid Orders" value={rows.length} />
        <Summary
          title="Total Ordered Qty"
          value={rows.reduce((sum, row) => sum + row.orderedQty, 0)}
        />
        <Summary
          title="Total Received Qty"
          value={rows.reduce((sum, row) => sum + row.receivedQty, 0)}
        />
        <Summary
          title="Total Received Value"
          value={formatMoney(rows.reduce((sum, row) => sum + row.totalGrandBdt, 0))}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Code Wise Receiving Report
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Product Code</Th>
                <Th center>Purchase Orders</Th>
                <Th center>Ordered Qty</Th>
                <Th center>Received Qty</Th>
                <Th center>Remaining Qty</Th>
                <Th center>Average Original Price</Th>
                <Th center>Total Received Cost</Th>
              </tr>
            </thead>

            <tbody>
              {groupedRows.map((group) => {
                const isOpen = Boolean(openRows[group.parentSku]);

                return (
                  <Fragment key={group.parentSku}>
                    <tr className="border-b">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => toggle(group.parentSku)}
                          className="hover:underline"
                        >
                          {isOpen ? "▼" : "▶"} {group.parentSku}
                        </button>
                      </td>
                      <Td center>{group.totalOrders}</Td>
                      <Td center>{group.orderedQty}</Td>
                      <Td center>{group.receivedQty}</Td>
                      <Td center>{group.remainingQty}</Td>
                      <Td center>{formatMoney(group.averageOriginalPrice)}</Td>
                      <Td center>{formatMoney(group.totalGrandBdt)}</Td>
                    </tr>

                    {isOpen &&
                      group.orders.map((row) => {
                        const form = getForm(row);
                        const totalCnfCharge =
                          form.packageWeight * form.cnfRatePerKg;
                        const grandTotal =
                          row.paidAmountBdt +
                          form.otherCostBdt +
                          totalCnfCharge;
                        const originalUnitPrice =
                          form.receivedQty > 0
                            ? grandTotal / form.receivedQty
                            : 0;

                        return (
                          <tr key={row.id} className="border-b bg-slate-50">
                            <td colSpan={7} className="px-5 py-5">
                              <div className="rounded-2xl border bg-white p-4">
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {row.invoiceNo}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {row.productSku} - {row.productName}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                        <StatusBadge status={row.status} />

                                        <Link
                                            href={`/dashboard/products-purchases/received-orders/${row.id}`}
                                            target="_blank"
                                            className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            View
                                        </Link>
                                        </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                  <Info label="Paid BDT" value={formatMoney(row.paidAmountBdt)} />
                                  <Info label="Ordered Qty" value={`${row.orderedQty} ${row.quantityType}`} />
                                  <Info label="Already Received" value={`${row.receivedQty} ${row.quantityType}`} />
                                  <Info label="Remaining Qty" value={`${row.remainingQty} ${row.quantityType}`} />
                                </div>

                                {row.remainingQty > 0 ? (
                                  <>
                                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                      <Input
                                        label="Receiving Date"
                                        type="date"
                                        value={form.receiveDate}
                                        onChange={(value) =>
                                          updateForm(row, { receiveDate: value })
                                        }
                                      />

                                      <NumberInput
                                        label="Final Receiving Quantity"
                                        value={form.receivedQty}
                                        onChange={(value) =>
                                          updateForm(row, { receivedQty: value })
                                        }
                                      />

                                      <NumberInput
                                        label="Package Weight"
                                        value={form.packageWeight}
                                        onChange={(value) =>
                                          updateForm(row, { packageWeight: value })
                                        }
                                      />

                                      <NumberInput
                                        label="CNF Weight Rate / KG"
                                        value={form.cnfRatePerKg}
                                        onChange={(value) =>
                                          updateForm(row, { cnfRatePerKg: value })
                                        }
                                      />

                                      <NumberInput
                                        label="Other Costing"
                                        value={form.otherCostBdt}
                                        onChange={(value) =>
                                          updateForm(row, { otherCostBdt: value })
                                        }
                                      />

                                      <Info
                                        label="Total CNF Charge"
                                        value={formatMoney(totalCnfCharge)}
                                      />

                                      <Info
                                        label="Grand Total"
                                        value={formatMoney(grandTotal)}
                                      />

                                      <Info
                                        label="Original Price / Unit"
                                        value={formatMoney(originalUnitPrice)}
                                      />

                                      <div className="md:col-span-2 xl:col-span-4">
                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                          Note
                                        </label>
                                        <textarea
                                          value={form.note}
                                          onChange={(e) =>
                                            updateForm(row, { note: e.target.value })
                                          }
                                          className="min-h-[80px] w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-5">
                                      <button
                                        type="button"
                                        disabled={pendingId === row.id}
                                        onClick={() => saveReceive(row)}
                                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                                      >
                                        {pendingId === row.id
                                          ? "Saving..."
                                          : "Save Receive"}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                                    Fully received.
                                  </div>
                                )}

                                {messageMap[row.id] ? (
                                  <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                                    {messageMap[row.id]}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}

              {!groupedRows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No paid purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
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