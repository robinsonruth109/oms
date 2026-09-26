import Link from "next/link";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function StockValuationPage() {
  // Keep Prisma out of module scope so Next.js build-time page collection does
  // not require DATABASE_URL. The database client is created only when this
  // dynamic dashboard page is actually requested.
  const { prisma } = await import("@/lib/prisma");

  const parents = await prisma.productParent.findMany({
    include: {
      products: {
        where: { status: true },
        include: { bundleComponents: { include: { componentProduct: true } } },
        orderBy: { sku: "asc" },
      },
    },
    orderBy: { sku: "asc" },
  });

  const rows: Array<{
    key: string;
    parentSku: string;
    sku: string;
    name: string;
    mode: string;
    quantity: number;
    unitCost: number;
    value: number;
    unitsPerSale: string;
  }> = [];

  const virtualBundles: Array<{
    sku: string; parent: string; components: string;
    sets: number; cost: number; legacyQty: number;
  }> = [];
  for (const parent of parents) {
    for (const product of parent.products) {
      if (product.inventoryKind !== "BUNDLE") continue;
      const parts = product.bundleComponents;
      virtualBundles.push({
        sku: product.sku,
        parent: parent.sku,
        components: parts.map((part) =>
          part.componentProduct.sku + " × " + part.units
        ).join(" + ") || "Recipe missing",
        sets: parts.length ? Math.max(0, Math.min(...parts.map((part) =>
          Math.floor(part.componentProduct.quantity / part.units)
        ))) : 0,
        cost: parts.reduce((sum, part) =>
          sum + Number(part.componentProduct.purchasePrice) * part.units, 0
        ),
        legacyQty: product.quantity,
      });
    }
    if (parent.stockMode === "PARENT_STOCK") {
      const quantity = Number(parent.stockQuantity || 0);
      const unitCost = Number(parent.purchasePrice || 0);
      rows.push({
        key: `parent-${parent.id}`,
        parentSku: parent.sku,
        sku: parent.products.filter((product) => product.inventoryKind !== "BUNDLE").map((product) => product.sku).join(", ") || "—",
        name: parent.name,
        mode: "Parent Stock",
        quantity,
        unitCost,
        value: quantity * unitCost,
        unitsPerSale:
          parent.products.filter((product) => product.inventoryKind !== "BUNDLE").map((product) => `${product.sku}: ${product.unitsPerSale}`).join(" · ") || "—",
      });
      continue;
    }

    for (const product of parent.products) {
      if (product.inventoryKind === "BUNDLE") continue;
      const quantity = Number(product.quantity || 0);
      const unitCost = Number(product.purchasePrice || 0);
      rows.push({
        key: product.id,
        parentSku: parent.sku,
        sku: product.sku,
        name: product.name,
        mode: "Variation Stock",
        quantity,
        unitCost,
        value: quantity * unitCost,
        unitsPerSale: String(product.unitsPerSale),
      });
    }
  }

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Valuation</h1>
            <p className="mt-1 text-sm text-slate-500">
              Physical inventory counted once at its real stock owner. Virtual bundle sets are excluded from the total.
            </p>
          </div>
          <Link
            href="/dashboard/damage-products"
            className="inline-flex rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            Damage Product Entry
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Physical stock units</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalUnits.toLocaleString("en-BD")}</p>
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Inventory purchase value</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{money(totalValue)}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                {["Parent", "SKU / Children", "Name", "Mode", "Units / Sale", "Stock", "Unit Cost", "Stock Value"].map((label) => (
                  <th key={label} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-b-0">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{row.parentSku}</td>
                  <td className="max-w-xs px-5 py-4 text-sm text-slate-700">{row.sku}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.name}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.mode}</td>
                  <td className="max-w-sm px-5 py-4 text-sm text-slate-700">{row.unitsPerSale}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900">{row.quantity.toLocaleString("en-BD")}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{money(row.unitCost)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{money(row.value)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No active inventory found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {virtualBundles.length ? (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-slate-900">
              Virtual bundle availability — not additional stock
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bundle component values are already counted in physical stock above.
              Old bundle quantity is preserved in the database but ignored here.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Bundle SKU</th>
                  <th className="px-4 py-3">Components</th>
                  <th className="px-4 py-3">Possible Sets</th>
                  <th className="px-4 py-3">Cost / Set</th>
                  <th className="px-4 py-3">Legacy Qty (ignored)</th>
                </tr>
              </thead>
              <tbody>
                {virtualBundles.map((row) => (
                  <tr key={row.sku} className="border-t">
                    <td className="px-4 py-3">{row.parent}</td>
                    <td className="px-4 py-3 font-semibold">{row.sku}</td>
                    <td className="px-4 py-3">{row.components}</td>
                    <td className="px-4 py-3 font-bold text-violet-700">{row.sets}</td>
                    <td className="px-4 py-3">{money(row.cost)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.legacyQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
