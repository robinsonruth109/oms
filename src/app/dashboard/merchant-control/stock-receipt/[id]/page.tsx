import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function MerchantStockReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MERCHANT"].includes(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const receipt = await prisma.merchantStockAllocation.findUnique({
    where: { id },
    include: {
      merchant: { select: { id: true, name: true, phone: true, address: true, userId: true } },
      product: { select: { sku: true, name: true } },
      parent: { select: { sku: true, name: true, stockMode: true } },
      createdByUser: { select: { name: true, username: true } },
    },
  });

  if (!receipt) notFound();

  if (session.user.role === "MERCHANT" && receipt.merchant.userId !== session.user.id) {
    redirect("/dashboard/merchant");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              OMS → Merchant Stock Transfer
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Product Buying / Stock Allocation Receipt
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Receipt No: <span className="font-mono font-semibold text-slate-800">{receipt.receiptNo}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={undefined}
            className="hidden"
            aria-hidden="true"
          />
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">
              {receipt.allocationDate.toISOString().slice(0, 10)}
            </p>
            <p className="text-slate-500">
              Created {formatBangladeshDateTime(receipt.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-b py-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">From</p>
            <p className="mt-2 text-lg font-bold text-slate-950">OMS Product Master</p>
            <p className="text-sm text-slate-500">Central inventory owner</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">To Merchant</p>
            <p className="mt-2 text-lg font-bold text-slate-950">{receipt.merchant.name}</p>
            <p className="text-sm text-slate-500">{receipt.merchant.phone}</p>
            <p className="mt-1 text-sm text-slate-500">{receipt.merchant.address}</p>
          </div>
        </div>

        <div className="overflow-x-auto py-5">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU / Product</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3 text-right">Sale Qty</th>
                <th className="px-4 py-3 text-right">Units / Sale</th>
                <th className="px-4 py-3 text-right">Physical Units</th>
                <th className="px-4 py-3 text-right">Buying Cost</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-4">
                  <p className="font-bold">{receipt.product.sku}</p>
                  <p className="text-xs text-slate-500">{receipt.product.name}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{receipt.parent.sku}</p>
                  <p className="text-xs text-slate-500">{receipt.parent.stockMode}</p>
                </td>
                <td className="px-4 py-4 text-right">{receipt.enteredQuantity}</td>
                <td className="px-4 py-4 text-right">{receipt.unitsPerSale}</td>
                <td className="px-4 py-4 text-right">{receipt.physicalUnits}</td>
                <td className="px-4 py-4 text-right">{money(Number(receipt.unitCost))}</td>
                <td className="px-4 py-4 text-right font-bold">{money(Number(receipt.totalCost))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="OMS Stock Before" value={String(receipt.omsStockBefore)} />
          <Stat label="OMS Stock After" value={String(receipt.omsStockAfter)} />
          <Stat label="Merchant Stock Before" value={String(receipt.merchantStockBefore)} />
          <Stat label="Merchant Stock After" value={String(receipt.merchantStockAfter)} />
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-t pt-5 text-sm">
          <div>
            <p className="text-slate-500">Note</p>
            <p className="mt-1 font-medium text-slate-800">{receipt.note || "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Created by</p>
            <p className="mt-1 font-semibold text-slate-900">
              {receipt.createdByUser.name || receipt.createdByUser.username}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 print:hidden">
        Use your browser print command to print or save this receipt as PDF.
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
