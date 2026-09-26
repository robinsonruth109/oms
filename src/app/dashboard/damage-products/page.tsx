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

import DamageEntryForm from "./damage-entry-form";

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

function componentBreakdownLabel(raw: string) {
  try {
    const rows = JSON.parse(raw) as Array<{
      ownerSku: string; units: number; before: number; after: number;
    }>;
    return rows.map((row) =>
      row.ownerSku + " × " + row.units + " (" +
      row.before + " → " + row.after + ")"
    ).join("; ");
  } catch {
    return "Historical component detail unavailable";
  }
}

export default async function DamageProductsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || "")) ? String(params.from) : today;
  let to = validDate(String(params.to || "")) ? String(params.to) : today;

  if (from > to) {
    [from, to] = [to, from];
  }

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
          include: { parent: true, bundleComponents: { include: { componentProduct: true } } },
          orderBy: { sku: "asc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.productDamageEntry.findMany({
      where: {
        damageDate: {
          gte: bangladeshDateStartUtc(from),
          lte: bangladeshDateEndUtc(to),
        },
      },
      orderBy: [{ damageDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);

  const resultProducts = products.map((product) => {
    const bundle = product.inventoryKind === "BUNDLE";
    const parentStock = product.parent.stockMode === "PARENT_STOCK";
    const parts = product.bundleComponents;
    const units = parts.reduce((sum, part) => sum + part.units, 0);
    const cost = parts.reduce((sum, part) =>
      sum + Number(part.componentProduct.purchasePrice) * part.units, 0
    );
    const sets = parts.length ? Math.max(0, Math.min(...parts.map((part) =>
      Math.floor(part.componentProduct.quantity / part.units)
    ))) : 0;
    return {
      id: product.id,
      parentSku: product.parent.sku,
      sku: product.sku,
      name: product.name,
      stockMode: bundle ? "BUNDLE" as const : product.parent.stockMode,
      currentStock: bundle ? sets
        : parentStock ? Number(product.parent.stockQuantity || 0)
        : Number(product.quantity || 0),
      unitsPerSale: bundle ? units : Math.max(1, Number(product.unitsPerSale || 1)),
      unitCost: bundle ? (units ? cost / units : 0)
        : parentStock ? Number(product.parent.purchasePrice || 0)
        : Number(product.purchasePrice || 0),
      bundleUnitCost: cost,
      componentSummary: bundle
        ? parts.map((part) => part.componentProduct.sku + " × " + part.units).join(" + ")
        : "",
    };
  });

  const totalEntryQty = entries.reduce(
    (sum, entry) => sum + Number(entry.enteredQuantity || 0),
    0
  );
  const totalPhysicalUnits = entries.reduce(
    (sum, entry) => sum + Number(entry.damagedStockUnits || 0),
    0
  );
  const totalDamageValue = entries.reduce(
    (sum, entry) => sum + Number(entry.damageValue || 0),
    0
  );

  const summaryMap = new Map<
    string,
    {
      key: string;
      parentSku: string;
      sku: string;
      productName: string;
      entryQty: number;
      physicalUnits: number;
      damageValue: number;
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
        entryQty: 0,
        physicalUnits: 0,
        damageValue: 0,
      };

    current.entryQty += Number(entry.enteredQuantity || 0);
    current.physicalUnits += Number(entry.damagedStockUnits || 0);
    current.damageValue += Number(entry.damageValue || 0);
    summaryMap.set(key, current);
  }

  const summaryRows = Array.from(summaryMap.values()).sort(
    (a, b) =>
      b.damageValue - a.damageValue ||
      a.parentSku.localeCompare(b.parentSku) ||
      a.sku.localeCompare(b.sku)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Damage Product Entry
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Find a SKU, record damaged quantity, deduct it from physical stock,
              and keep a purchase-cost damage report.
            </p>
          </div>
          <Link
            href="/dashboard/stock-adjustments"
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Adjust Product Qty
          </Link>
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
              autoFocus
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
              <h2 className="font-semibold text-slate-900">
                Search Results
              </h2>
              <p className="text-xs text-slate-500">
                {resultProducts.length} product(s) found
              </p>
            </div>

            {resultProducts.map((product) => (
              <DamageEntryForm
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
            Search a child SKU or Parent Code to start a damage entry.
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Damage Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Filter damage entries by Bangladesh business date.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-700">Damage Entries</p>
          <p className="mt-2 text-3xl font-bold text-sky-900">
            {entries.length}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-violet-700">
            Entered Damage Qty
          </p>
          <p className="mt-2 text-3xl font-bold text-violet-900">
            {totalEntryQty.toLocaleString("en-BD")}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-orange-700">
            Physical Units Damaged
          </p>
          <p className="mt-2 text-3xl font-bold text-orange-900">
            {totalPhysicalUnits.toLocaleString("en-BD")}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-rose-700">
            Total Damage Value
          </p>
          <p className="mt-2 text-2xl font-bold text-rose-900">
            {money(totalDamageValue)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product-wise Damage Summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {from} to {to}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Parent Code</th>
                <th className="px-5 py-3">Child SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Damage Qty</th>
                <th className="px-5 py-3 text-right">Physical Units</th>
                <th className="px-5 py-3 text-right">Damage Value</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {row.parentSku}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-800">
                    {row.sku}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {row.productName}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {row.entryQty.toLocaleString("en-BD")}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-orange-700">
                    {row.physicalUnits.toLocaleString("en-BD")}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-rose-700">
                    {money(row.damageValue)}
                  </td>
                </tr>
              ))}

              {!summaryRows.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No damage entries found for this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>

            {summaryRows.length ? (
              <tfoot className="border-t-2 bg-slate-50 font-bold">
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-right">
                    Total
                  </td>
                  <td className="px-5 py-4 text-right">
                    {totalEntryQty.toLocaleString("en-BD")}
                  </td>
                  <td className="px-5 py-4 text-right text-orange-700">
                    {totalPhysicalUnits.toLocaleString("en-BD")}
                  </td>
                  <td className="px-5 py-4 text-right text-rose-700">
                    {money(totalDamageValue)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Damage Entry History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest 500 entries inside the selected date range.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Damage Date</th>
                <th className="px-5 py-3">Parent / SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3 text-right">Entered Qty</th>
                <th className="px-5 py-3 text-right">Physical Units</th>
                <th className="px-5 py-3 text-right">Unit Cost</th>
                <th className="px-5 py-3 text-right">Damage Value</th>
                <th className="px-5 py-3 text-right">Stock Before</th>
                <th className="px-5 py-3 text-right">Stock After</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Entered By</th>
                <th className="px-5 py-3">Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="px-5 py-4 font-medium">
                    {formatBangladeshDate(entry.damageDate)}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {entry.parentSkuSnapshot}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.skuSnapshot}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.productNameSnapshot}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.componentBreakdown ? "Virtual Bundle" : entry.stockOwnerType === "PRODUCT_PARENT"
                      ? `Parent Stock × ${entry.unitsPerSale}`
                      : "Variation Stock"}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {entry.enteredQuantity}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-orange-700">
                    {entry.damagedStockUnits}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(Number(entry.unitCost || 0))}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-rose-700">
                    {money(Number(entry.damageValue || 0))}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {entry.componentBreakdown ? "—" : entry.stockBefore}
                  </td>
                  <td
                    className={
                      "px-5 py-4 text-right font-semibold " +
                      (entry.stockAfter < 0 ? "text-red-600" : "text-slate-900")
                    }
                  >
                    {entry.componentBreakdown ? "—" : entry.stockAfter}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-slate-600">
                    {entry.note || "—"}
                    {entry.componentBreakdown ? (
                      <p className="mt-1 break-words text-xs text-violet-700">
                        Components: {componentBreakdownLabel(entry.componentBreakdown)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.createdByName}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {formatBangladeshDateTime(entry.createdAt)}
                  </td>
                </tr>
              ))}

              {!entries.length ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No damage history found for this date range.
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
