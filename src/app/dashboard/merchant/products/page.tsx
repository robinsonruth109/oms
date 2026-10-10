import { Fragment } from "react";
import { requireMerchantContext, formatTaka } from "@/lib/merchant-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantProductsPage() {
  const { merchant } = await requireMerchantContext();
  const { prisma } = await import("@/lib/prisma");

  const parents = await prisma.productParent.findMany({
    where: { merchantId: merchant.id, status: true },
    orderBy: { sku: "asc" },
    include: {
      products: {
        where: { status: true },
        orderBy: { sku: "asc" },
      },
    },
  });

  const rows = parents.map((parent) => {
    if (parent.stockMode === "PARENT_STOCK") {
      const available = Math.max(
        0,
        Number(parent.stockQuantity || 0) -
          Number(parent.omsOwnedStockQuantity || 0)
      );
      const unitCost = Number(parent.purchasePrice || 0);
      const value = parent.stockVerifiedAt ? available * unitCost : 0;

      return {
        key: parent.id,
        parentSku: parent.sku,
        parentName: parent.name,
        mode: "Parent Stock",
        stock: available,
        rawStock: Number(parent.stockQuantity || 0),
        omsReserve: Number(parent.omsOwnedStockQuantity || 0),
        unitCost,
        value,
        verified: Boolean(parent.stockVerifiedAt),
        children: parent.products.map((product) => ({
          sku: product.sku,
          name: product.name,
          stock: Math.max(
            0,
            Math.floor(available / Math.max(1, Number(product.unitsPerSale || 1)))
          ),
          unitsPerSale: Math.max(1, Number(product.unitsPerSale || 1)),
          unitCost,
        })),
      };
    }

    const children = parent.products
      .filter((product) => product.inventoryKind !== "BUNDLE")
      .map((product) => {
        const stock = Math.max(
          0,
          Number(product.quantity || 0) -
            Number(product.omsOwnedStockQuantity || 0)
        );
        const unitCost = Number(product.purchasePrice || 0);
        const value = product.stockVerifiedAt ? stock * unitCost : 0;

        return {
          sku: product.sku,
          name: product.name,
          stock,
          unitsPerSale: 1,
          unitCost,
          value,
          verified: Boolean(product.stockVerifiedAt),
          omsReserve: Number(product.omsOwnedStockQuantity || 0),
        };
      });

    return {
      key: parent.id,
      parentSku: parent.sku,
      parentName: parent.name,
      mode: "Variation Stock",
      stock: children.reduce((sum, row) => sum + row.stock, 0),
      rawStock: children.reduce(
        (sum, row) => sum + row.stock + Number(row.omsReserve || 0),
        0
      ),
      omsReserve: children.reduce(
        (sum, row) => sum + Number(row.omsReserve || 0),
        0
      ),
      unitCost: 0,
      value: children.reduce((sum, row) => sum + Number(row.value || 0), 0),
      verified: children.every((row) => row.verified),
      children,
    };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Products & Stock
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {merchant.name} · Merchant-owned physical inventory only. OMS-reserved
          units are excluded from your available stock and valuation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Parent Products" value={String(rows.length)} />
          <Stat
            label="Available Physical Units"
            value={rows
              .reduce((sum, row) => sum + row.stock, 0)
              .toLocaleString("en-BD")}
          />
          <Stat label="Stock Valuation" value={formatTaka(totalValue)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Parent / SKU</th>
                <th className="px-5 py-4">Inventory Type</th>
                <th className="px-5 py-4 text-right">Available</th>
                <th className="px-5 py-4 text-right">OMS Reserve</th>
                <th className="px-5 py-4 text-right">Buying Cost</th>
                <th className="px-5 py-4 text-right">Valuation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.key}>
                  <tr className="border-t bg-white">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950">{row.parentSku}</p>
                      <p className="text-xs text-slate-500">{row.parentName}</p>
                    </td>
                    <td className="px-5 py-4">{row.mode}</td>
                    <td className="px-5 py-4 text-right font-bold">
                      {row.stock.toLocaleString("en-BD")}
                    </td>
                    <td className="px-5 py-4 text-right text-violet-700">
                      {row.omsReserve.toLocaleString("en-BD")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.unitCost ? formatTaka(row.unitCost) : "Mixed"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold">
                      {formatTaka(row.value)}
                    </td>
                  </tr>
                  {row.children.map((child) => (
                    <tr
                      key={row.key + "::" + child.sku}
                      className="border-t bg-slate-50/70"
                    >
                      <td className="px-5 py-3 pl-10">
                        <p className="font-semibold text-slate-800">
                          ↳ {child.sku}
                        </p>
                        <p className="text-xs text-slate-500">{child.name}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {row.mode === "Parent Stock"
                          ? "Uses " + child.unitsPerSale + " parent unit(s) / sale"
                          : "Independent stock"}
                      </td>
                      <td className="px-5 py-3 text-right">{child.stock}</td>
                      <td className="px-5 py-3 text-right text-violet-700">
                        {"omsReserve" in child
                          ? Number(child.omsReserve || 0)
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatTaka(child.unitCost)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {"value" in child
                          ? formatTaka(Number(child.value || 0))
                          : "Parent valuation"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No Product Parent has been assigned to your Merchant account.
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
