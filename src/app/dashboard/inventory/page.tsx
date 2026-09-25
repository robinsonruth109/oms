import { activateInventory, setActualStock } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    message?: string;
  }>;
};

function money(value: number) {
  return "৳ " + Number(value || 0).toFixed(2);
}

function dateTime(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const message = String(params.message || "").trim();

  const parents = await prisma.productParent.findMany({
    where: q
      ? {
          OR: [
            { sku: { contains: q } },
            { name: { contains: q } },
            { products: { some: { sku: { contains: q } } } },
            { products: { some: { name: { contains: q } } } },
          ],
        }
      : undefined,
    include: {
      products: {
        orderBy: { sku: "asc" },
      },
    },
    orderBy: { sku: "asc" },
    take: 80,
  });

  const activeParents = parents.filter((parent) => parent.stockTrackingActive);
  const inactiveParents = parents.filter((parent) => !parent.stockTrackingActive);

  const totalStockValue = activeParents.reduce((sum, parent) => {
    if (parent.inventoryMode === "SHARED_PARENT") {
      return (
        sum +
        Number(parent.stockQuantity) * Number(parent.averageCost)
      );
    }

    return (
      sum +
      parent.products.reduce(
        (childSum, product) =>
          childSum +
          Number(product.stockQuantity) * Number(product.averageCost),
        0
      )
    );
  }, 0);

  const negativeCount = activeParents.reduce((count, parent) => {
    if (parent.inventoryMode === "SHARED_PARENT") {
      return count + (parent.stockQuantity <= 0 ? 1 : 0);
    }

    return (
      count +
      parent.products.filter((product) => product.stockQuantity <= 0).length
    );
  }, 0);

  const recentMovements = await prisma.stockMovement.findMany({
    include: {
      productParent: { select: { sku: true, name: true } },
      product: { select: { sku: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Inventory & Stock Valuation
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock tracking is opt-in per Product Parent. Historical orders are
          ignored until you activate a parent with an actual opening stock.
        </p>
      </section>

      {message ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary title="Tracked Parents" value={String(activeParents.length)} />
        <Summary title="Stock Valuation" value={money(totalStockValue)} />
        <Summary
          title="Zero / Negative Warnings"
          value={String(negativeCount)}
          danger={negativeCount > 0}
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search parent SKU, child SKU or product name..."
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
          <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">
            Search
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Active Inventory
          </h2>
          <p className="text-sm text-slate-500">
            CSV/Push All deducts stock, Purchase Received adds stock, and
            tracked Pathao returns restore stock.
          </p>
        </div>

        {activeParents.map((parent) => (
          <article
            key={parent.id}
            className="overflow-hidden rounded-3xl border bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {parent.sku} — {parent.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {parent.inventoryMode === "SHARED_PARENT"
                    ? "Shared Parent Stock"
                    : "Child / Variant Stock"}{" "}
                  · Activated {dateTime(parent.stockActivatedAt)}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                TRACKING ACTIVE
              </span>
            </div>

            {parent.inventoryMode === "SHARED_PARENT" ? (
              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr]">
                <div className="grid grid-cols-3 gap-3">
                  <Metric
                    title="Current Stock"
                    value={String(parent.stockQuantity)}
                    danger={parent.stockQuantity <= 0}
                  />
                  <Metric
                    title="Avg Cost"
                    value={money(Number(parent.averageCost))}
                  />
                  <Metric
                    title="Stock Value"
                    value={money(
                      parent.stockQuantity * Number(parent.averageCost)
                    )}
                  />
                </div>

                <form action={setActualStock} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input type="hidden" name="parentId" value={parent.id} />
                  <input type="hidden" name="productId" value="" />
                  <input
                    type="number"
                    name="actualQty"
                    defaultValue={parent.stockQuantity}
                    className="rounded-xl border px-3 py-2 text-sm"
                    placeholder="Actual stock"
                  />
                  <input
                    type="text"
                    name="note"
                    placeholder="Adjustment note"
                    className="rounded-xl border px-3 py-2 text-sm"
                  />
                  <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Set Actual Stock
                  </button>
                </form>

                <div className="lg:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Child SKU consumption
                  </p>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {parent.products.map((product) => (
                      <div
                        key={product.id}
                        className="rounded-xl border bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold">{product.sku}</span>
                        <span className="text-slate-500">
                          {" "}→ {product.quantity} physical unit(s) per sale
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <Th>SKU</Th>
                      <Th>Name</Th>
                      <Th>Units / Sale</Th>
                      <Th>Stock</Th>
                      <Th>Avg Cost</Th>
                      <Th>Value</Th>
                      <Th>Set Actual Stock</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {parent.products.map((product) => (
                      <tr key={product.id} className="border-b last:border-b-0">
                        <Td bold>{product.sku}</Td>
                        <Td>{product.name}</Td>
                        <Td>{product.quantity}</Td>
                        <Td danger={product.stockQuantity <= 0}>
                          {product.stockQuantity}
                        </Td>
                        <Td>{money(Number(product.averageCost))}</Td>
                        <Td>
                          {money(
                            product.stockQuantity * Number(product.averageCost)
                          )}
                        </Td>
                        <td className="px-5 py-3">
                          <form action={setActualStock} className="flex min-w-[360px] gap-2">
                            <input type="hidden" name="parentId" value={parent.id} />
                            <input type="hidden" name="productId" value={product.id} />
                            <input
                              type="number"
                              name="actualQty"
                              defaultValue={product.stockQuantity}
                              className="w-28 rounded-lg border px-2 py-1.5 text-sm"
                            />
                            <input
                              type="text"
                              name="note"
                              placeholder="Note"
                              className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm"
                            />
                            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                              Update
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}

        {!activeParents.length ? (
          <div className="rounded-2xl border bg-white px-5 py-8 text-center text-sm text-slate-500">
            No tracked inventory found for this search.
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Activate Existing Product Stock
          </h2>
          <p className="text-sm text-slate-500">
            Enter the real opening quantity. Nothing before this activation
            time is deducted or added.
          </p>
        </div>

        {inactiveParents.map((parent) => (
          <form
            key={parent.id}
            action={activateInventory}
            className="rounded-3xl border bg-white p-5 shadow-sm"
          >
            <input type="hidden" name="parentId" value={parent.id} />

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {parent.sku} — {parent.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Current legacy quantities are not treated as stock.
                </p>
              </div>

              <select
                name="inventoryMode"
                defaultValue="SHARED_PARENT"
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="SHARED_PARENT">Shared Parent Stock</option>
                <option value="CHILD_VARIANT">Child / Variant Stock</option>
              </select>
            </div>

            <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Shared Parent opening stock
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Used when all child SKUs consume the same physical parent stock.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  name="openingQty"
                  defaultValue={0}
                  placeholder="Opening physical qty"
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  name="openingCost"
                  defaultValue={0}
                  placeholder="Weighted cost per physical unit"
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b">
                    <Th>Child SKU</Th>
                    <Th>Name</Th>
                    <Th>Units per Sale</Th>
                    <Th>Variant Opening Stock</Th>
                    <Th>Variant Opening Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {parent.products.map((product) => (
                    <tr key={product.id} className="border-b last:border-b-0">
                      <Td bold>{product.sku}</Td>
                      <Td>{product.name}</Td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          min="1"
                          name={"unitsPerSale_" + product.id}
                          defaultValue={Math.max(1, product.quantity)}
                          className="w-28 rounded-lg border px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          name={"openingQty_" + product.id}
                          defaultValue={0}
                          className="w-32 rounded-lg border px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          step="0.01"
                          name={"openingCost_" + product.id}
                          defaultValue={Number(product.purchasePrice)}
                          className="w-32 rounded-lg border px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
                Activate Stock Tracking
              </button>
            </div>
          </form>
        ))}

        {!inactiveParents.length ? (
          <div className="rounded-2xl border bg-white px-5 py-8 text-center text-sm text-slate-500">
            No inactive Product Parent found for this search.
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Stock Ledger
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Last 100 stock movements. Negative balances are allowed and shown as warnings.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Date</Th>
                <Th>Parent</Th>
                <Th>Variant</Th>
                <Th>Type</Th>
                <Th>Change</Th>
                <Th>Before</Th>
                <Th>After</Th>
                <Th>Avg Cost</Th>
                <Th>Value</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <Td>{dateTime(row.createdAt)}</Td>
                  <Td bold>{row.productParent.sku}</Td>
                  <Td>{row.product?.sku || "Shared"}</Td>
                  <Td>{row.movementType}</Td>
                  <Td danger={row.quantityDelta < 0}>
                    {row.quantityDelta > 0 ? "+" : ""}
                    {row.quantityDelta}
                  </Td>
                  <Td>{row.balanceBefore}</Td>
                  <Td danger={row.balanceAfter <= 0}>{row.balanceAfter}</Td>
                  <Td>{money(Number(row.averageCostAfter))}</Td>
                  <Td>{money(Number(row.stockValueAfter))}</Td>
                  <Td>{row.note || "—"}</Td>
                </tr>
              ))}
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
  danger,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p
        className={
          "mt-2 text-2xl font-bold " +
          (danger ? "text-red-600" : "text-slate-900")
        }
      >
        {value}
      </p>
    </div>
  );
}

function Metric({
  title,
  value,
  danger,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={"mt-1 font-bold " + (danger ? "text-red-600" : "text-slate-900")}>
        {value}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({
  children,
  bold,
  danger,
}: {
  children: React.ReactNode;
  bold?: boolean;
  danger?: boolean;
}) {
  return (
    <td
      className={
        "px-5 py-3 text-sm " +
        (bold ? "font-semibold " : "") +
        (danger ? "text-red-600" : "text-slate-700")
      }
    >
      {children}
    </td>
  );
}
