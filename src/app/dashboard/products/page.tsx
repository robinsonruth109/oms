import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import CreateProductForm from "./create-product-form";
import CsvImportForm from "./csv-import-form";
import EditProductForm from "./edit-product-form";


type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    edit?: string;
  }>;
};
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }
  const canManageMaster = session.user.role === "ADMIN";

  const params = (await searchParams) || {};
  const q = (params.q || "").trim();
  const edit = (params.edit || "").trim();
  const { prisma } = await import("@/lib/prisma");
  const where =
    q.length > 0
      ? {
          OR: [
            {
              sku: {
                contains: q,
              },
            },
            {
              name: {
                contains: q,
              },
            },
            {
              parent: {
                sku: {
                  contains: q,
                },
              },
            },
            {
              parent: {
                name: {
                  contains: q,
                },
              },
            },
          ],
        }
      : undefined;

  const [products, editProduct] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        parent: true,
        bundleComponents: { include: { componentProduct: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    edit && canManageMaster
      ? prisma.product.findUnique({
          where: {
            id: edit,
          },
          include: {
            parent: true,
          },
        })
      : null,
  ]);

  function displayStock(product: (typeof products)[number]) {
    return product.inventoryKind === "BUNDLE"
      ? product.bundleComponents.length
        ? Math.max(0, Math.min(...product.bundleComponents.map((part) =>
            Math.floor(part.componentProduct.quantity / part.units)
          )))
        : 0
      : product.parent.stockMode === "PARENT_STOCK"
        ? product.parent.stockQuantity : product.quantity;
  }
  function displayCost(product: (typeof products)[number]) {
    return product.inventoryKind === "BUNDLE"
      ? product.bundleComponents.reduce(
          (sum, part) => sum + Number(part.componentProduct.purchasePrice) * part.units, 0
        )
      : Number(product.parent.stockMode === "PARENT_STOCK"
          ? product.parent.purchasePrice || 0 : product.purchasePrice);
  }
  function displayMode(product: (typeof products)[number]) {
    return product.inventoryKind === "BUNDLE" ? "Virtual Bundle"
      : product.parent.stockMode === "PARENT_STOCK"
        ? "Parent Stock" : "Variation Stock";
  }
  function displayUnits(product: (typeof products)[number]) {
    return product.inventoryKind === "BUNDLE"
      ? product.bundleComponents.map((part) =>
          part.componentProduct.sku + " × " + part.units
        ).join(" + ") || "Recipe missing"
      : String(product.unitsPerSale);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Master</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage parent and variation inventory. Parent Stock shares one physical
              quantity across child SKUs; Variation Stock keeps inventory per child.
            </p>
            {!canManageMaster ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Manager view: master-data create/edit/import is Admin-only. Stock adjustment is available.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageMaster ? (
              <Link href="/dashboard/products/bundles"
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
                Configure Bundles
              </Link>
            ) : null}
            <Link href="/dashboard/stock-adjustments"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
              Adjust Stock
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by SKU, product name, parent SKU..."
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>
      </section>

      {canManageMaster && editProduct ? (
        <EditProductForm
          product={{
            id: editProduct.id,
            sku: editProduct.sku,
            name: editProduct.name,
            quantity: editProduct.quantity,
            unitsPerSale: editProduct.unitsPerSale,
            inventoryKind: editProduct.inventoryKind,
            purchasePrice: String(editProduct.purchasePrice),
            sellingPrice: String(editProduct.sellingPrice),
            status: editProduct.status,
            parent: {
              sku: editProduct.parent.sku,
              name: editProduct.parent.name,
              stockMode: editProduct.parent.stockMode,
              stockQuantity: editProduct.parent.stockQuantity,
              purchasePrice: String(editProduct.parent.purchasePrice || 0),
            },
          }}
        />
      ) : null}

      {canManageMaster ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <CreateProductForm />
          <CsvImportForm />
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Product List</h2>
          <p className="mt-1 text-sm text-slate-500">
            Showing up to 100 products. Use search to narrow results.
          </p>
        </div>

        <div className="space-y-4 p-4 lg:hidden">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{product.sku}</h3>
                  <p className="text-sm text-slate-500">{product.name}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/stock-adjustments?q=${encodeURIComponent(product.sku)}`}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Adjust
                  </Link>
                  {canManageMaster ? (
                    <Link
                      href={`/dashboard/products?${q ? `q=${encodeURIComponent(q)}&` : ""}edit=${product.id}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canManageMaster ? (
                    <Link
                      href={"/dashboard/products/bundles?q=" + encodeURIComponent(product.sku)}
                      className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700"
                    >
                      Bundle
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Parent SKU</p>
                  <p className="font-medium text-slate-800">{product.parent.sku}</p>
                </div>
                <div>
                  <p className="text-slate-400">Stock Mode</p>
                  <p className="font-medium text-slate-800">
                    {displayMode(product)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Available Stock</p>
                  <p className="font-medium text-slate-800">
                    {displayStock(product)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Units / Sale</p>
                  <p className="font-medium text-slate-800">{displayUnits(product)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Status</p>
                  <p className="font-medium text-slate-800">
                    {product.status ? "Active" : "Inactive"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Purchase</p>
                  <p className="font-medium text-slate-800">
                    ৳ {displayCost(product).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Sell</p>
                  <p className="font-medium text-slate-800">
                    ৳ {Number(product.sellingPrice).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parent SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock / Mode
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Units / Sale
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Purchase
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sell
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {product.parent.sku}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div className="font-medium">
                      {displayStock(product)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {displayMode(product)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {displayUnits(product)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    ৳ {displayCost(product).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    ৳ {Number(product.sellingPrice).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {product.status ? "Active" : "Inactive"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/stock-adjustments?q=${encodeURIComponent(product.sku)}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Adjust
                      </Link>
                      {canManageMaster ? (
                        <Link
                          href={`/dashboard/products?${q ? `q=${encodeURIComponent(q)}&` : ""}edit=${product.id}`}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}