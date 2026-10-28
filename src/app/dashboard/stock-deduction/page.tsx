import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams?: Promise<{ from?: string; to?: string; q?: string }> };

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function bdDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function bdDateTime(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("en-BD", { timeZone: "Asia/Dhaka" });
}

export default async function StockDeductionPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") redirect("/dashboard");

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];
  const q = String(params.q || "").trim();

  const rows = await prisma.orderItem.findMany({
    where: {
      stockDeductedAt: {
        gte: bangladeshDateStartUtc(from),
        lte: bangladeshDateEndUtc(to),
      },
      stockDeductionSource: { in: ["CSV_BATCH", "PUSH_ALL_COURIERS", "MERCHANT_ALLOCATION"] },
      ...(q
        ? {
            OR: [
              { productSku: { contains: q } },
              { productName: { contains: q } },
              { order: { is: { invoiceId: { contains: q } } } },
              { order: { is: { orderId: { contains: q } } } },
              { order: { is: { customerName: { contains: q } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ stockDeductedAt: "desc" }, { createdAt: "desc" }],
    take: 5000,
    select: {
      id: true,
      productSku: true,
      productName: true,
      quantity: true,
      stockDeductedAt: true,
      stockDeductionSource: true,
      stockDeductedUnits: true,
      stockOwnerId: true,
      order: {
        select: {
          id: true,
          invoiceId: true,
          orderId: true,
          customerName: true,
          pathaoConsignmentId: true,
          pathaoCourier: { select: { name: true } },
        },
      },
      product: {
        select: {
          parent: { select: { sku: true, name: true } },
        },
      },
    },
  });

  const merchantIds = Array.from(
    new Set(
      rows
        .filter((row) => row.stockDeductionSource === "MERCHANT_ALLOCATION")
        .map((row) => row.stockOwnerId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const merchantMap = new Map(
    (merchantIds.length
      ? await prisma.merchant.findMany({
          where: { id: { in: merchantIds } },
          select: { id: true, name: true },
        })
      : []
    ).map((row) => [row.id, row.name])
  );

  const daily = new Map<string, Map<string, {
    sku: string;
    name: string;
    parentSku: string;
    saleQty: number;
    physicalUnits: number;
    orders: Set<string>;
  }>>();

  for (const row of rows) {
    const date = bdDate(row.stockDeductedAt);
    const sku = row.productSku;
    const bySku = daily.get(date) || new Map();
    const current = bySku.get(sku) || {
      sku,
      name: row.productName,
      parentSku: row.product?.parent?.sku || "-",
      saleQty: 0,
      physicalUnits: 0,
      orders: new Set<string>(),
    };
    current.saleQty += Math.max(0, row.quantity);
    current.physicalUnits += Math.max(0, row.stockDeductedUnits);
    current.orders.add(row.order.id);
    bySku.set(sku, current);
    daily.set(date, bySku);
  }

  const dailyRows = Array.from(daily.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([date, bySku]) =>
      Array.from(bySku.values())
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map((row) => ({ date, ...row, orderCount: row.orders.size }))
    );

  const totalSaleQty = rows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
  const totalPhysical = rows.reduce((sum, row) => sum + Math.max(0, row.stockDeductedUnits), 0);
  const totalOrders = new Set(rows.map((row) => row.order.id)).size;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Stock Deduction</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Daily outbound stock ledger. Every stock deduction created when an order is sent to courier is shown here.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            From
            <input type="date" name="from" defaultValue={from} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input type="date" name="to" defaultValue={to} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Search
            <input name="q" defaultValue={q} placeholder="SKU, invoice, order, customer" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Apply Filter</button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Courier Orders" value={totalOrders.toLocaleString("en-BD")} />
        <Stat label="Sale Qty Sent" value={totalSaleQty.toLocaleString("en-BD")} />
        <Stat label="Physical Units Out" value={totalPhysical.toLocaleString("en-BD")} />
        <Stat label="Deduction Lines" value={rows.length.toLocaleString("en-BD")} />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Daily SKU Outbound Summary</h2>
          <p className="mt-1 text-xs text-slate-500">Shows how much product left stock on each Bangladesh date.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <Th>Date</Th>
                <Th>Parent / SKU</Th>
                <Th right>Orders</Th>
                <Th right>Sale Qty</Th>
                <Th right>Physical Units Out</Th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.date + ":" + row.sku} className="border-t">
                  <Td><span className="font-bold">{row.date}</span></Td>
                  <Td>
                    <p className="font-bold text-slate-950">{row.parentSku}</p>
                    <p className="mt-1">{row.sku}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.name}</p>
                  </Td>
                  <Td right>{row.orderCount.toLocaleString("en-BD")}</Td>
                  <Td right><span className="font-bold">{row.saleQty.toLocaleString("en-BD")}</span></Td>
                  <Td right><span className="font-extrabold text-rose-700">-{row.physicalUnits.toLocaleString("en-BD")}</span></Td>
                </tr>
              ))}
              {!dailyRows.length ? <tr><td colSpan={5}><Empty /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Detailed Deduction Log</h2>
        </div>
        <div className="max-h-[720px] overflow-auto">
          <table className="min-w-[1450px] w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <Th>Date / Time</Th>
                <Th>Parent / SKU</Th>
                <Th>Invoice / Customer</Th>
                <Th>Courier / CID</Th>
                <Th>Stock Bucket</Th>
                <Th right>Sale Qty</Th>
                <Th right>Physical Units Out</Th>
                <Th>Deduction Source</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <Td>{bdDateTime(row.stockDeductedAt)}</Td>
                  <Td>
                    <p className="font-bold">{row.product?.parent?.sku || "-"}</p>
                    <p className="mt-1">{row.productSku}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.productName}</p>
                  </Td>
                  <Td>
                    <p className="font-bold">{row.order.invoiceId || row.order.orderId || row.order.id}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.order.customerName}</p>
                  </Td>
                  <Td>
                    <p>{row.order.pathaoCourier?.name || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.order.pathaoConsignmentId || "-"}</p>
                  </Td>
                  <Td>
                    {row.stockDeductionSource === "MERCHANT_ALLOCATION"
                      ? merchantMap.get(row.stockOwnerId || "") || "Merchant allocation"
                      : "OMS Product Master"}
                  </Td>
                  <Td right>{row.quantity.toLocaleString("en-BD")}</Td>
                  <Td right><span className="font-extrabold text-rose-700">-{row.stockDeductedUnits.toLocaleString("en-BD")}</span></Td>
                  <Td>{row.stockDeductionSource || "-"}</Td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8}><Empty /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-950">{value}</p></div>;
}
function Empty() {
  return <div className="p-10 text-center text-sm text-slate-500">No courier stock deduction found for the selected date range.</div>;
}
function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={"px-4 py-3 " + (right ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, right }: { children: ReactNode; right?: boolean }) {
  return <td className={"px-4 py-3 " + (right ? "text-right" : "text-left")}>{children}</td>;
}
