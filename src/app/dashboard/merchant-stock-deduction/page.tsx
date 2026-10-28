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

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    merchantId?: string;
    q?: string;
  }>;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("en-BD", { timeZone: "Asia/Dhaka" });
}

export default async function MerchantStockDeductionPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();

  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;
  if (from > to) [from, to] = [to, from];

  const merchantId = String(params.merchantId || "").trim();
  const q = String(params.q || "").trim();

  const [merchants, rows] = await Promise.all([
    prisma.merchant.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.orderItem.findMany({
      where: {
        stockDeductionSource: "MERCHANT_ALLOCATION",
        stockDeductedAt: {
          gte: bangladeshDateStartUtc(from),
          lte: bangladeshDateEndUtc(to),
        },
        ...(merchantId ? { stockOwnerId: merchantId } : {}),
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
      take: 3000,
      select: {
        id: true,
        productSku: true,
        productName: true,
        quantity: true,
        stockDeductedAt: true,
        stockDeductedUnits: true,
        stockUnitsPerSale: true,
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
        stockAllocations: {
          select: {
            ownerId: true,
            ownerSkuSnapshot: true,
            deductedUnits: true,
            restoredUnits: true,
          },
        },
      },
    }),
  ]);

  const merchantIds = Array.from(
    new Set(rows.map((row) => row.stockOwnerId).filter((id): id is string => Boolean(id)))
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

  const allocationIds = Array.from(
    new Set(rows.flatMap((row) => row.stockAllocations.map((item) => item.ownerId)))
  );
  const allocationMap = new Map(
    (allocationIds.length
      ? await prisma.merchantStockAllocation.findMany({
          where: { id: { in: allocationIds } },
          select: {
            id: true,
            receiptNo: true,
            remainingPhysicalUnits: true,
            unitCost: true,
          },
        })
      : []
    ).map((row) => [row.id, row])
  );

  const totalSaleQty = rows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
  const deducted = rows.reduce((sum, row) => sum + Math.max(0, row.stockDeductedUnits), 0);
  const restored = rows.reduce(
    (sum, row) =>
      sum +
      row.stockAllocations.reduce(
        (inner, allocation) => inner + Math.max(0, allocation.restoredUnits),
        0
      ),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Stock Deduction</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Merchant allocated-stock deductions created by courier submission. Product Master is not deducted again; these rows consume the Merchant allocation receipts.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-medium text-slate-600">
            From
            <input type="date" name="from" defaultValue={from} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input type="date" name="to" defaultValue={to} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Merchant
            <select name="merchantId" defaultValue={merchantId} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm">
              <option value="">All Merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
              ))}
            </select>
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
        <Stat label="Deduction Rows" value={rows.length.toLocaleString("en-BD")} />
        <Stat label="Sale Qty" value={totalSaleQty.toLocaleString("en-BD")} />
        <Stat label="Physical Units Deducted" value={deducted.toLocaleString("en-BD")} />
        <Stat label="Net Units Out" value={Math.max(0, deducted - restored).toLocaleString("en-BD")} sub={"Restored: " + restored.toLocaleString("en-BD")} />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="space-y-3 p-3 md:hidden">
          {rows.map((row) => {
            const restoredUnits = row.stockAllocations.reduce((sum, item) => sum + Math.max(0, item.restoredUnits), 0);
            return (
              <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-950">{row.productSku}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.productName}</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">-{row.stockDeductedUnits}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Info label="Merchant" value={merchantMap.get(row.stockOwnerId || "") || "Unknown"} />
                  <Info label="Invoice" value={row.order.invoiceId || row.order.orderId || row.order.id} />
                  <Info label="Sale Qty" value={String(row.quantity)} />
                  <Info label="Restored" value={String(restoredUnits)} />
                  <Info label="Parent" value={row.product?.parent?.sku || "-"} />
                  <Info label="Courier" value={row.order.pathaoCourier?.name || "-"} />
                </div>
                <p className="mt-3 text-xs text-slate-400">{formatDateTime(row.stockDeductedAt)}</p>
              </article>
            );
          })}
          {!rows.length ? <Empty /> : null}
        </div>

        <div className="hidden max-h-[700px] overflow-auto md:block">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <Th>Date / Time</Th>
                <Th>Merchant</Th>
                <Th>Parent / SKU</Th>
                <Th>Invoice / Customer</Th>
                <Th>Courier / CID</Th>
                <Th right>Sale Qty</Th>
                <Th right>Physical Deducted</Th>
                <Th right>Restored</Th>
                <Th right>Net Out</Th>
                <Th>Allocation Receipt(s) / Current Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const restoredUnits = row.stockAllocations.reduce((sum, item) => sum + Math.max(0, item.restoredUnits), 0);
                return (
                  <tr key={row.id} className="border-t align-top">
                    <Td>{formatDateTime(row.stockDeductedAt)}</Td>
                    <Td><span className="font-semibold">{merchantMap.get(row.stockOwnerId || "") || "Unknown"}</span></Td>
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
                    <Td right>{row.quantity.toLocaleString("en-BD")}</Td>
                    <Td right><span className="font-bold text-rose-700">-{row.stockDeductedUnits.toLocaleString("en-BD")}</span></Td>
                    <Td right><span className="font-semibold text-emerald-700">+{restoredUnits.toLocaleString("en-BD")}</span></Td>
                    <Td right><span className="font-bold">{Math.max(0, row.stockDeductedUnits - restoredUnits).toLocaleString("en-BD")}</span></Td>
                    <Td>
                      <div className="space-y-1">
                        {row.stockAllocations.map((item) => {
                          const allocation = allocationMap.get(item.ownerId);
                          return (
                            <div key={item.ownerId} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                              <p className="font-semibold">{allocation?.receiptNo || item.ownerSkuSnapshot}</p>
                              <p className="mt-1 text-slate-500">
                                Deducted {item.deductedUnits} · Restored {item.restoredUnits} · Current receipt balance {allocation?.remainingPhysicalUnits ?? "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr><td colSpan={10}><Empty /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-950">{value}</p>{sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}</div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-slate-800">{value}</p></div>;
}
function Empty() {
  return <div className="p-10 text-center text-sm text-slate-500">No Merchant stock deduction found for the selected filters.</div>;
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={"px-4 py-3 " + (right ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={"px-4 py-3 " + (right ? "text-right" : "text-left")}>{children}</td>;
}
