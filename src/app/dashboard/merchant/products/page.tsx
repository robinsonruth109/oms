import { Fragment } from "react";
import { requireMerchantContext, formatTaka } from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantProductsPage() {
  const { merchant } = await requireMerchantContext();
  const { prisma } = await import("@/lib/prisma");

  const allocations = await prisma.merchantStockAllocation.findMany({
    where: {
      merchantId: merchant.id,
      remainingPhysicalUnits: { gt: 0 },
    },
    orderBy: [{ allocationDate: "desc" }, { createdAt: "desc" }],
    include: {
      product: {
        include: {
          parent: true,
        },
      },
    },
  });

  type ChildRow = {
    productId: string;
    sku: string;
    name: string;
    unitsPerSale: number;
    physicalUnits: number;
    saleQtyAvailable: number;
    value: number;
    weightedCost: number;
  };

  type ParentRow = {
    parentId: string;
    parentSku: string;
    parentName: string;
    mode: string;
    physicalUnits: number;
    value: number;
    children: Map<string, ChildRow>;
  };

  const parentMap = new Map<string, ParentRow>();

  for (const allocation of allocations) {
    const product = allocation.product;
    const parent = product.parent;
    const remaining = Math.max(0, Number(allocation.remainingPhysicalUnits || 0));
    const unitCost = Number(allocation.unitCost || 0);
    const value = remaining * unitCost;
    const unitsPerSale = Math.max(1, Number(allocation.unitsPerSale || 1));

    const parentRow =
      parentMap.get(parent.id) ||
      {
        parentId: parent.id,
        parentSku: parent.sku,
        parentName: parent.name,
        mode: parent.stockMode === "PARENT_STOCK" ? "Parent Stock" : "Variation Stock",
        physicalUnits: 0,
        value: 0,
        children: new Map<string, ChildRow>(),
      };

    parentRow.physicalUnits += remaining;
    parentRow.value += value;

    const child =
      parentRow.children.get(product.id) ||
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitsPerSale,
        physicalUnits: 0,
        saleQtyAvailable: 0,
        value: 0,
        weightedCost: 0,
      };

    const previousPhysical = child.physicalUnits;
    const nextPhysical = previousPhysical + remaining;
    child.weightedCost =
      nextPhysical > 0
        ? (child.weightedCost * previousPhysical + unitCost * remaining) / nextPhysical
        : 0;
    child.physicalUnits = nextPhysical;
    child.saleQtyAvailable = Math.floor(nextPhysical / unitsPerSale);
    child.value += value;

    parentRow.children.set(product.id, child);
    parentMap.set(parent.id, parentRow);
  }

  const rows = Array.from(parentMap.values())
    .map((row) => ({
      ...row,
      children: Array.from(row.children.values()).sort((a, b) =>
        a.sku.localeCompare(b.sku)
      ),
    }))
    .sort((a, b) => a.parentSku.localeCompare(b.parentSku));

  const totalPhysicalUnits = rows.reduce((sum, row) => sum + row.physicalUnits, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const allocatedSkuCount = new Set(
    rows.flatMap((row) => row.children.map((child) => child.productId))
  ).size;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Products & Stock</h1>
        <p className="mt-1 text-sm text-slate-500">
          {merchant.name} · Stock allocated from OMS Product Master. OMS remains the
          master product owner; only your allocated balance is shown here.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Allocated SKUs" value={String(allocatedSkuCount)} />
          <Stat
            label="Available Physical Units"
            value={totalPhysicalUnits.toLocaleString("en-BD")}
          />
          <Stat label="Allocated Stock Value" value={formatTaka(totalValue)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Parent / SKU</th>
                <th className="px-5 py-4">Inventory Type</th>
                <th className="px-5 py-4 text-right">Physical Units</th>
                <th className="px-5 py-4 text-right">Sale Qty Available</th>
                <th className="px-5 py-4 text-right">Buying Cost</th>
                <th className="px-5 py-4 text-right">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.parentId}>
                  <tr className="border-t bg-white">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950">{row.parentSku}</p>
                      <p className="text-xs text-slate-500">{row.parentName}</p>
                    </td>
                    <td className="px-5 py-4">{row.mode}</td>
                    <td className="px-5 py-4 text-right font-bold">
                      {row.physicalUnits.toLocaleString("en-BD")}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-500">See SKU</td>
                    <td className="px-5 py-4 text-right text-slate-500">Mixed / receipt cost</td>
                    <td className="px-5 py-4 text-right font-bold">
                      {formatTaka(row.value)}
                    </td>
                  </tr>

                  {row.children.map((child) => (
                    <tr key={child.productId} className="border-t bg-slate-50/70">
                      <td className="px-5 py-3 pl-10">
                        <p className="font-semibold text-slate-800">↳ {child.sku}</p>
                        <p className="text-xs text-slate-500">{child.name}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {row.mode === "Parent Stock"
                          ? "Uses " + child.unitsPerSale + " parent unit(s) / sale"
                          : "Independent allocated stock"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {child.physicalUnits.toLocaleString("en-BD")}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {child.saleQtyAvailable.toLocaleString("en-BD")}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatTaka(child.weightedCost)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatTaka(child.value)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    OMS has not allocated any stock to this Merchant yet.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
