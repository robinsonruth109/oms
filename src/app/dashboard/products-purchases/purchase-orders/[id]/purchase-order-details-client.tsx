"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createPurchasePayment,
  deletePurchaseOrder,
  deletePurchasePayment,
} from "../actions";

type PurchaseOrder = {
  id: string;
  invoiceNo: string;
  productSku: string;
  productName: string;
  parentSku: string;
  orderDate: string;
  quantity: number;
  quantityType: string;
  productImage: string | null;
  unitPriceUsd: number;
  platformChargeUsd: number;
  shippingUsd: number;
  subtotalUsd: number;
  status: string;
  note: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  paymentDate: string;
  paymentType: string;
  amountUsd: number;
  usdRate: number;
  amountBdt: number;
  note: string | null;
};

type Summary = {
  totalPayableUsd: number;
  totalPaidUsd: number;
  totalPaidBdt: number;
  dueUsd: number;
  averageUsdRate: number;
};

const paymentTypes = [
  "ADVANCE",
  "PRODUCTION_READY",
  "DISPATCH_PAYMENT",
  "FINAL_PAYMENT",
  "OTHER",
];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatUsd(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

function formatBdt(value: number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

export default function PurchaseOrderDetailsClient({
  order,
  payments,
  summary,
}: {
  order: PurchaseOrder;
  payments: Payment[];
  summary: Summary;
}) {
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [paymentType, setPaymentType] = useState("ADVANCE");
  const [amountUsd, setAmountUsd] = useState(0);
  const [usdRate, setUsdRate] = useState(120);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const amountBdt = amountUsd * usdRate;
  const averageProductPrice =
    order.quantity > 0 ? summary.totalPaidBdt / order.quantity : 0;

  function addPayment() {
    setMessage("");

    startTransition(async () => {
      const result = await createPurchasePayment({
        purchaseOrderId: order.id,
        paymentDate,
        paymentType,
        amountUsd,
        usdRate,
        note,
      });

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    });
  }

  function removePayment(paymentId: string) {
    const confirmed = window.confirm("Delete this payment?");
    if (!confirmed) return;

    setMessage("");

    startTransition(async () => {
      const result = await deletePurchasePayment(paymentId, order.id);
      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    });
  }

  function removeOrder() {
    const confirmed = window.confirm(
      "Delete this purchase order? All payments for this purchase order will also be deleted."
    );

    if (!confirmed) return;

    setMessage("");

    startTransition(async () => {
      const result = await deletePurchaseOrder(order.id);
      setMessage(result.message);

      if (result.success) {
        window.location.href = "/dashboard/products-purchases/purchase-orders";
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Purchase Order Invoice
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Invoice No: {order.invoiceNo}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/products-purchases/purchase-orders"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>

            <button
              type="button"
              onClick={removeOrder}
              disabled={pending}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Delete Order
            </button>
          </div>
        </div>
      </section>

      {message ? (
        <section className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Information
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Info label="Product SKU" value={order.productSku} />
            <Info label="Product Name" value={order.productName} />
            <Info label="Parent Code" value={order.parentSku} />
            <Info label="Order Date" value={order.orderDate} />
            <Info
              label="Quantity"
              value={`${order.quantity} ${order.quantityType}`}
            />
            <Info label="Status" value={order.status} />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Image
          </h2>

          {order.productImage ? (
            <img
              src={order.productImage}
              alt={order.productName}
              className="mt-5 h-56 w-full rounded-2xl border object-cover"
            />
          ) : (
            <div className="mt-5 flex h-56 items-center justify-center rounded-2xl border bg-slate-50 text-sm text-slate-500">
              No image added
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Purchase Cost
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Unit Price USD" value={formatUsd(order.unitPriceUsd)} />
          <Info
            label="Platform Charge USD"
            value={formatUsd(order.platformChargeUsd)}
          />
          <Info
            label="Shipping Charge USD"
            value={formatUsd(order.shippingUsd)}
          />
          <Info
            label="Total Payable USD"
            value={formatUsd(order.subtotalUsd)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Total Payable"
          value={formatUsd(summary.totalPayableUsd)}
        />
        <SummaryCard title="Paid USD" value={formatUsd(summary.totalPaidUsd)} />
        <SummaryCard title="Due USD" value={formatUsd(summary.dueUsd)} />
        <SummaryCard title="Paid BDT" value={formatBdt(summary.totalPaidBdt)} />
        <SummaryCard
          title="Average USD Rate"
          value={
            summary.averageUsdRate
              ? summary.averageUsdRate.toFixed(2)
              : "0.00"
          }
        />
        <SummaryCard
          title="Average Product Price"
          value={formatBdt(averageProductPrice)}
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add Payment</h2>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Payment Type
            </label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              {paymentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <NumberInput
            label="Amount USD"
            value={amountUsd}
            onChange={setAmountUsd}
          />

          <NumberInput
            label="USD Rate"
            value={usdRate}
            onChange={setUsdRate}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Amount BDT
            </label>
            <div className="rounded-xl border bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-900">
              {formatBdt(amountBdt)}
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={addPayment}
            disabled={pending}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving..." : "Add Payment"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Payment History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>USD</Th>
                <Th>Rate</Th>
                <Th>BDT</Th>
                <Th>Note</Th>
                <Th>Action</Th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-b-0">
                  <Td>{payment.paymentDate}</Td>
                  <Td>{payment.paymentType}</Td>
                  <Td>{formatUsd(payment.amountUsd)}</Td>
                  <Td>{payment.usdRate.toFixed(2)}</Td>
                  <Td>{formatBdt(payment.amountBdt)}</Td>
                  <Td>{payment.note || "N/A"}</Td>
                  <td className="px-5 py-4 text-sm">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removePayment(payment.id)}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!payments.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No payment added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Note</h2>

        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {order.note || "No note added."}
        </p>
      </section>
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 text-sm text-slate-700">{children}</td>;
}