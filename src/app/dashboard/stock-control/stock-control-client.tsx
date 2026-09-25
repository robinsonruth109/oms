"use client";

import { useActionState } from "react";
import { saveStockSetup, type StockActionState } from "./actions";

const initialState: StockActionState = {
  success: false,
  message: "",
};

type StockData = {
  id: string;
  quantity: number;
  averageCost: string;
  activatedAt: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  unitsPerSale: number;
  purchasePrice: string;
  sellingPrice: string;
  stock: StockData | null;
};

type ParentRow = {
  id: string;
  sku: string;
  name: string;
  inventoryMode: "SHARED_PARENT" | "VARIANT" | null;
  stock: StockData | null;
  products: ProductRow[];
};

type MovementRow = {
  id: string;
  movementType: string;
  quantityChange: number;
  balanceBefore: number;
  balanceAfter: number;
  averageCostAfter: string;
  createdAt: string;
  target: string;
  note: string;
};

function money(value: string | number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

function StockEditorForm({
  parentId,
  productId,
  mode,
  current,
  label,
}: {
  parentId: string;
  productId?: string;
  mode: "SHARED_PARENT" | "VARIANT";
  current: StockData | null;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveStockSetup,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border bg-white p-4">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="productId" value={productId || ""} />
      <input type="hidden" name="mode" value={mode} />

      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">
          {current
            ? `Tracking active since ${new Date(current.activatedAt).toLocaleString()}`
            : "Not activated. Saving the first count starts stock tracking from that moment."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Actual Physical Stock
          </label>
          <input
            name="quantity"
            type="number"
            defaultValue={current?.quantity ?? 0}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            required
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Zero and negative values are allowed.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Average Physical Unit Cost
          </label>
          <input
            name="averageCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={current?.averageCost ?? "0"}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Note
        </label>
        <input
          name="note"
          type="text"
          placeholder="Optional stock count / adjustment note"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
        />
      </div>

      {state.message ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs ${
            state.success
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending
          ? "Saving..."
          : current
            ? "Update Actual Stock"
            : "Activate Stock Tracking"}
      </button>
    </form>
  );
}

export default function StockControlClient({
  parents,
  movements,
  summary,
  q,
}: {
  parents: ParentRow[];
  movements: MovementRow[];
  summary: {
    trackedTargets: number;
    physicalUnits: number;
    valuation: number;
    negativeTargets: number;
  };
  q: string;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Stock Control & Valuation
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Existing products stay untracked until you enter a real physical
          stock count here. From activation onward, successful CSV/Pathao issue
          deducts stock, Purchase Received adds stock, and Pathao Return restores
          stock.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary title="Tracked Stock Targets" value={summary.trackedTargets} />
        <Summary title="Physical Units" value={summary.physicalUnits} />
        <Summary
          title="Stock Valuation"
          value={money(summary.valuation)}
        />
        <Summary
          title="Zero / Negative"
          value={summary.negativeTargets}
          warning={summary.negativeTargets > 0}
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="flex gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search parent SKU, child SKU, or product name..."
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
          <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">
            Search
          </button>
        </form>
      </section>

      <section className="space-y-5">
        {parents.map((parent) => (
          <article
            key={parent.id}
            className="overflow-hidden rounded-3xl border bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {parent.sku}
                </h2>
                <p className="text-sm text-slate-500">{parent.name}</p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  parent.inventoryMode === "SHARED_PARENT"
                    ? "bg-blue-50 text-blue-700"
                    : parent.inventoryMode === "VARIANT"
                      ? "bg-violet-50 text-violet-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {parent.inventoryMode === "SHARED_PARENT"
                  ? "Shared Parent Stock"
                  : parent.inventoryMode === "VARIANT"
                    ? "Variant / Child Stock"
                    : "Not Configured"}
              </span>
            </div>

            <div className="space-y-5 p-5">
              {parent.inventoryMode !== "VARIANT" ? (
                <div>
                  <div className="mb-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <strong>Shared Parent Stock:</strong> all child SKUs consume
                    the same physical stock. Child “Units per Sale” decides how
                    many pieces are deducted. Example: A-3 with Units/Sale 5
                    deducts 5 physical pieces per ordered unit.
                  </div>

                  <StockEditorForm
                    parentId={parent.id}
                    mode="SHARED_PARENT"
                    current={parent.stock}
                    label={`${parent.sku} Shared Physical Stock`}
                  />
                </div>
              ) : null}

              {parent.inventoryMode !== "SHARED_PARENT" ? (
                <div>
                  <div className="mb-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    <strong>Variant / Child Stock:</strong> each child SKU owns
                    its own stock and weighted-average cost. Activate only the
                    child SKUs whose real stock you have counted.
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {parent.products.map((product) => (
                      <div key={product.id} className="space-y-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {product.sku} — {product.name}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Units / Sale: {product.unitsPerSale}</span>
                            <span>Product Master Cost: {money(product.purchasePrice)}</span>
                            <span>Sell: {money(product.sellingPrice)}</span>
                          </div>
                        </div>

                        <StockEditorForm
                          parentId={parent.id}
                          productId={product.id}
                          mode="VARIANT"
                          current={product.stock}
                          label={product.sku}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {parent.inventoryMode === "SHARED_PARENT" ? (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-4 py-3">Child SKU</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Units / Sale</th>
                        <th className="px-4 py-3">Sell Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parent.products.map((product) => (
                        <tr key={product.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3 text-sm font-semibold">
                            {product.sku}
                          </td>
                          <td className="px-4 py-3 text-sm">{product.name}</td>
                          <td className="px-4 py-3 text-sm">
                            {product.unitsPerSale}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {money(product.sellingPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {!parents.length ? (
          <div className="rounded-3xl border bg-white p-10 text-center text-sm text-slate-500">
            No products found.
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Stock Movements
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Ledger history is the audit trail. Negative stock is warned but
            never blocks order flow.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
                <th className="px-4 py-3">Avg Cost</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-sm">
                    {new Date(movement.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {movement.target}
                  </td>
                  <td className="px-4 py-3 text-xs">{movement.movementType}</td>
                  <td
                    className={`px-4 py-3 text-sm font-semibold ${
                      movement.quantityChange < 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {movement.quantityChange > 0 ? "+" : ""}
                    {movement.quantityChange}
                  </td>
                  <td className="px-4 py-3 text-sm">{movement.balanceBefore}</td>
                  <td
                    className={`px-4 py-3 text-sm font-semibold ${
                      movement.balanceAfter <= 0 ? "text-red-600" : ""
                    }`}
                  >
                    {movement.balanceAfter}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {money(movement.averageCostAfter)}
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs text-slate-500">
                    {movement.note}
                  </td>
                </tr>
              ))}

              {!movements.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    No stock movements yet. Activate a product to start the ledger.
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
  title,
  value,
  warning = false,
}: {
  title: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        warning ? "border-red-200 bg-red-50" : "bg-white"
      }`}
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          warning ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
