import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PackagePlus, ReceiptText } from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDate,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import LocalProductPurchaseForm, {
  type LocalPurchaseProductOption,
} from "./local-purchase-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
  }>;
};

type LocalPurchaseMeta = {
  kind: "LOCAL_PRODUCT_PURCHASE";
  unitPurchaseCost: number;
  productCostTotal: number;
  transportCost: number;
  otherCost: number;
  grandTotalCost: number;
  landedUnitCost: number;
  previousBuyingPrice: number;
  newBuyingPrice: number;
  stockWasVerified: boolean;
  userNote?: string | null;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthStart(today: string) {
  return today.slice(0, 8) + "01";
}

function parseLocalPurchase(raw: string | null): LocalPurchaseMeta | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      !value ||
      typeof value !== "object" ||
      value.kind !== "LOCAL_PRODUCT_PURCHASE"
    ) {
      return null;
    }

    const number = (field: string) => {
      const parsed = Number(value[field] ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      kind: "LOCAL_PRODUCT_PURCHASE",
      unitPurchaseCost: number("unitPurchaseCost"),
      productCostTotal: number("productCostTotal"),
      transportCost: number("transportCost"),
      otherCost: number("otherCost"),
      grandTotalCost: number("grandTotalCost"),
      landedUnitCost: number("landedUnitCost"),
      previousBuyingPrice: number("previousBuyingPrice"),
      newBuyingPrice: number("newBuyingPrice"),
      stockWasVerified: Boolean(value.stockWasVerified),
      userNote:
        typeof value.userNote === "string" ? value.userNote : null,
    };
  } catch {
    return null;
  }
}

export default async function LocalProductPurchasePage({
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  let from = validDate(String(params.from || ""))
    ? String(params.from)
    : monthStart(today);
  let to = validDate(String(params.to || ""))
    ? String(params.to)
    : today;

  if (from > to) [from, to] = [to, from];

  const { prisma } = await import("@/lib/prisma");

  const [rawProducts, entries] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: true,
        inventoryKind: "PHYSICAL",
      },
      include: {
        parent: true,
      },
      orderBy: [{ sku: "asc" }],
    }),
    prisma.productStockAdjustment.findMany({
      where: {
        reason: "Local Product Purchase",
        adjustmentDate: {
          gte: bangladeshDateStartUtc(from),
          lte: bangladeshDateEndUtc(to),
        },
      },
      orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);

  const products: LocalPurchaseProductOption[] = rawProducts
    .filter((product) => product.parent.status)
    .map((product) => {
      const parentStock = product.parent.stockMode === "PARENT_STOCK";
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        parentSku: product.parent.sku,
        parentName: product.parent.name,
        stockMode: product.parent.stockMode,
        unitsPerSale: parentStock
          ? Math.max(1, Number(product.unitsPerSale || 1))
          : 1,
        currentStock: parentStock
          ? Number(product.parent.stockQuantity || 0)
          : Number(product.quantity || 0),
        currentBuyingPrice: Number(
          parentStock
            ? product.parent.purchasePrice || 0
            : product.purchasePrice || 0
        ),
        stockVerified: parentStock
          ? Boolean(product.parent.stockVerifiedAt)
          : Boolean(product.stockVerifiedAt),
      };
    });

  const history = entries
    .map((entry) => ({
      entry,
      meta: parseLocalPurchase(entry.componentBreakdown),
    }))
    .filter(
      (
        row
      ): row is {
        entry: (typeof entries)[number];
        meta: LocalPurchaseMeta;
      } => Boolean(row.meta)
    );

  const totalPurchaseQty = history.reduce(
    (sum, row) => sum + Number(row.entry.enteredQuantity || 0),
    0
  );
  const totalPhysicalUnits = history.reduce(
    (sum, row) => sum + Number(row.entry.adjustedStockUnits || 0),
    0
  );
  const totalProductCost = history.reduce(
    (sum, row) => sum + row.meta.productCostTotal,
    0
  );
  const totalTransport = history.reduce(
    (sum, row) => sum + row.meta.transportCost,
    0
  );
  const totalOther = history.reduce(
    (sum, row) => sum + row.meta.otherCost,
    0
  );
  const totalLanded = history.reduce(
    (sum, row) => sum + row.meta.grandTotalCost,
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackagePlus className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                Local Product Purchase
              </h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Purchase physical stock locally in BDT. Quantity increases the
              correct stock owner and the Product Master buying price becomes
              this purchase batch&apos;s landed cost after Vara and other cost.
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
              href="/dashboard/stock-adjustments"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Stock Adjustment
            </Link>
          </div>
        </div>
      </section>

      <LocalProductPurchaseForm products={products} today={today} />

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-slate-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Local Purchase Report
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter purchase history by Bangladesh business date.
            </p>
          </div>
        </div>

        <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="min-h-11 w-full rounded-xl border px-3 outline-none"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="min-h-11 w-full rounded-xl border px-3 outline-none"
            />
          </label>
          <button className="self-end rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Apply Filter
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Summary label="Purchases" value={String(history.length)} />
        <Summary
          label="Purchase Qty"
          value={totalPurchaseQty.toLocaleString("en-BD")}
        />
        <Summary
          label="Physical Units Added"
          value={totalPhysicalUnits.toLocaleString("en-BD")}
        />
        <Summary label="Product Cost" value={money(totalProductCost)} />
        <Summary label="Vara" value={money(totalTransport)} />
        <Summary
          label="Grand Landed Cost"
          value={money(totalLanded)}
          note={"Other " + money(totalOther)}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Purchase History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {from} to {to} · latest 500 local purchases.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Parent / SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Stock Mode</th>
                <th className="px-5 py-3 text-right">Purchase Qty</th>
                <th className="px-5 py-3 text-right">Stock Added</th>
                <th className="px-5 py-3 text-right">Unit Purchase</th>
                <th className="px-5 py-3 text-right">Product Cost</th>
                <th className="px-5 py-3 text-right">Vara</th>
                <th className="px-5 py-3 text-right">Other</th>
                <th className="px-5 py-3 text-right">Grand Total</th>
                <th className="px-5 py-3 text-right">Landed Buying</th>
                <th className="px-5 py-3 text-right">Buying Price</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3">Entered By</th>
                <th className="px-5 py-3">Note / Recorded</th>
              </tr>
            </thead>
            <tbody>
              {history.map(({ entry, meta }) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="px-5 py-4 font-medium">
                    {formatBangladeshDate(entry.adjustmentDate)}
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
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {entry.stockOwnerType === "PRODUCT_PARENT"
                        ? "Parent Stock × " + entry.unitsPerSale
                        : "Variation Stock"}
                    </span>
                    {!meta.stockWasVerified ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        Owner remains unverified
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {entry.enteredQuantity}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                    +{entry.adjustedStockUnits}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(meta.unitPurchaseCost)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(meta.productCostTotal)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(meta.transportCost)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(meta.otherCost)}
                  </td>
                  <td className="px-5 py-4 text-right font-bold">
                    {money(meta.grandTotalCost)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                    {money(meta.landedUnitCost)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-slate-500">
                      {money(meta.previousBuyingPrice)}
                    </span>
                    <span className="mx-1">→</span>
                    <span className="font-semibold text-slate-900">
                      {money(meta.newBuyingPrice)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {entry.stockBefore} →{" "}
                    <strong>{entry.stockAfter}</strong>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.createdByName}
                  </td>
                  <td className="max-w-sm px-5 py-4 text-slate-600">
                    <p>{entry.note || "—"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatBangladeshDateTime(entry.createdAt)}
                    </p>
                  </td>
                </tr>
              ))}
              {!history.length ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No local product purchases found in this date range.
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

function Summary({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
