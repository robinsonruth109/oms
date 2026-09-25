import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDate,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

import StockAdjustmentForm from "./stock-adjustment-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    q?: string;
    from?: string;
    to?: string;
  }>;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function money(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function StockAdjustmentsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;

  if (from > to) [from, to] = [to, from];

  const { prisma } = await import("@/lib/prisma");

  const [products, entries] = await Promise.all([
    q
      ? prisma.product.findMany({
          where: {
            status: true,
            OR: [
              { sku: { contains: q } },
              { name: { contains: q } },
              { parent: { sku: { contains: q } } },
              { parent: { name: { contains: q } } },
            ],
          },
          include: { parent: true },
          orderBy: { sku: "asc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.productStockAdjustment.findMany({
      where: {
        adjustmentDate: {
          gte: bangladeshDateStartUtc(from),
          lte: bangladeshDateEndUtc(to),
        },
      },
      orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);

  const resultProducts = products.map((product) => {
    const parentStock = product.parent.stockMode === "PARENT_STOCK";

    return {
      id: product.id,
      parentSku: product.parent.sku,
      sku: product.sku,
      name: product.name,
      stockMode: product.parent.stockMode,
      currentStock: parentStock
        ? Number(product.parent.stockQuantity || 0)
        : Number(product.quantity || 0),
      unitsPerSale: Math.max(1, Number(product.unitsPerSale || 1)),
      unitCost: parentStock
        ? Number(product.parent.purchasePrice || 0)
        : Number(product.purchasePrice || 0),
    };
  });

  const addedUnits = entries
    .filter((entry) => entry.adjustmentType === "ADD")
    .reduce((sum, entry) => sum + Number(entry.adjustedStockUnits || 0), 0);
  const reducedUnits = entries
    .filter((entry) => entry.adjustmentType === "REDUCE")
    .reduce((sum, entry) => sum + Number(entry.adjustedStockUnits || 0), 0);
  const addedValue = entries
    .filter((entry) => entry.adjustmentType === "ADD")
    .reduce((sum, entry) => sum + Number(entry.adjustmentValue || 0), 0);
  const reducedValue = entries
    .filter((entry) => entry.adjustmentType === "REDUCE")
    .reduce((sum, entry) => sum + Number(entry.adjustmentValue || 0), 0);

  const summaryMap = new Map<
    string,
    {
      key: string;
      parentSku: string;
      sku: string;
      productName: string;
      addedUnits: number;
      reducedUnits: number;
      netUnits: number;
      netValue: number;
    }
  >();

  for (const entry of entries) {
    const key = `${entry.parentSkuSnapshot}::${entry.skuSnapshot}`;
    const current =
      summaryMap.get(key) ||
      {
        key,
        parentSku: entry.parentSkuSnapshot,
        sku: entry.skuSnapshot,
        productName: entry.productNameSnapshot,
        addedUnits: 0,
        reducedUnits: 0,
        netUnits: 0,
        netValue: 0,
      };

    const units = Number(entry.adjustedStockUnits || 0);
    const value = Number(entry.adjustmentValue || 0);

    if (entry.adjustmentType === "ADD") {
      current.addedUnits += units;
      current.netUnits += units;
      current.netValue += value;
    } else {
      current.reducedUnits += units;
      current.netUnits -= units;
      current.netValue -= value;
    }

    summaryMap.set(key, current);
  }

  const summaryRows = Array.from(summaryMap.values()).sort(
    (a, b) =>
      Math.abs(b.netValue) - Math.abs(a.netValue) ||
      a.parentSku.localeCompare(b.parentSku) ||
      a.sku.localeCompare(b.sku)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Stock Adjustment
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Add forgotten/found stock or reduce lost/missing stock with a permanent audit history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/products"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Product Master
            </Link>
            <Link
              href="/dashboard/damage-products"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Damage Products
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Find Product by SKU / Name / Parent Code
            </span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Example: Code-Sp-110"
              className="w-full rounded-xl border px-4 py-3 outline-none"
            />
          </label>
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <button className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white">
            Search Product
          </button>
        </form>

        {q ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Search Results</h2>
              <p className="text-xs text-slate-500">
                {resultProducts.length} product(s) found
              </p>
            </div>

            {resultProducts.map((product) => (
              <StockAdjustmentForm
                key={product.id}
                product={product}
                today={today}
              />
            ))}

            {!resultProducts.length ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                No active Product Master SKU matched “{q}”.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed bg-slate-50 p-6 text-sm text-slate-500">
            Search a child SKU or Parent Code to add or reduce stock.
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Adjustment Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Filter manual stock changes by Bangladesh business date.
          </p>
        </div>

        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="q" value={q} />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 outline-none"
            />
          </label>
          <button className="self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Apply Report Filter
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-700">Entries</p>
          <p className="mt-2 text-3xl font-bold text-sky-900">{entries.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Added Units</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">
            +{addedUnits.toLocaleString("en-BD")}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-rose-700">Reduced Units</p>
          <p className="mt-2 text-3xl font-bold text-rose-900">
            -{reducedUnits.toLocaleString("en-BD")}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-violet-700">Net Units</p>
          <p className="mt-2 text-3xl font-bold text-violet-900">
            {(addedUnits - reducedUnits).toLocaleString("en-BD")}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-700">Net Value Impact</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {money(addedValue - reducedValue)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product-wise Adjustment Summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">{from} to {to}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Parent Code</th>
                <th className="px-5 py-3">Child SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Added</th>
                <th className="px-5 py-3 text-right">Reduced</th>
                <th className="px-5 py-3 text-right">Net Units</th>
                <th className="px-5 py-3 text-right">Net Value</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="px-5 py-4 font-semibold text-slate-900">{row.parentSku}</td>
                  <td className="px-5 py-4 font-medium text-slate-800">{row.sku}</td>
                  <td className="px-5 py-4 text-slate-700">{row.productName}</td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                    +{row.addedUnits}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-rose-700">
                    -{row.reducedUnits}
                  </td>
                  <td className="px-5 py-4 text-right font-bold">{row.netUnits}</td>
                  <td
                    className={
                      "px-5 py-4 text-right font-bold " +
                      (row.netValue < 0 ? "text-rose-700" : "text-emerald-700")
                    }
                  >
                    {money(row.netValue)}
                  </td>
                </tr>
              ))}
              {!summaryRows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No stock adjustments found for this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Adjustment History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest 500 manual adjustments inside the selected date range.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Parent / SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3 text-right">Entered Qty</th>
                <th className="px-5 py-3 text-right">Physical Units</th>
                <th className="px-5 py-3 text-right">Value</th>
                <th className="px-5 py-3 text-right">Stock Before</th>
                <th className="px-5 py-3 text-right">Stock After</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Entered By</th>
                <th className="px-5 py-3">Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="px-5 py-4 font-medium">
                    {formatBangladeshDate(entry.adjustmentDate)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-semibold " +
                        (entry.adjustmentType === "ADD"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700")
                      }
                    >
                      {entry.adjustmentType === "ADD" ? "ADD" : "REDUCE"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{entry.parentSkuSnapshot}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.skuSnapshot}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{entry.productNameSnapshot}</td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.stockOwnerType === "PRODUCT_PARENT"
                      ? `Parent Stock × ${entry.unitsPerSale}`
                      : "Variation Stock"}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">{entry.enteredQuantity}</td>
                  <td className="px-5 py-4 text-right font-semibold">{entry.adjustedStockUnits}</td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {money(Number(entry.adjustmentValue || 0))}
                  </td>
                  <td className="px-5 py-4 text-right">{entry.stockBefore}</td>
                  <td
                    className={
                      "px-5 py-4 text-right font-semibold " +
                      (entry.stockAfter < 0 ? "text-red-600" : "text-slate-900")
                    }
                  >
                    {entry.stockAfter}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-700">{entry.reason}</td>
                  <td className="max-w-xs px-5 py-4 text-slate-600">{entry.note || "—"}</td>
                  <td className="px-5 py-4 text-slate-700">{entry.createdByName}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {formatBangladeshDateTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
              {!entries.length ? (
                <tr>
                  <td colSpan={14} className="px-5 py-10 text-center text-slate-500">
                    No adjustment history found for this date range.
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
