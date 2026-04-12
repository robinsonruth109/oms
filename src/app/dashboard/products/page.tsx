import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CreateProductForm from "./create-product-form";
import CsvImportForm from "./csv-import-form";
import EditProductForm from "./edit-product-form";

type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    edit?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = (await searchParams) || {};
  const q = (params.q || "").trim();
  const edit = (params.edit || "").trim();

  const where =
    q.length > 0
      ? {
          OR: [
            {
              sku: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              name: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              parent: {
                sku: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              parent: {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    edit
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Product Master</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage parent SKU and child SKU products. Search, update, import CSV,
          and use them in manual order entry.
        </p>
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

      {editProduct ? (
        <EditProductForm
          product={{
            id: editProduct.id,
            sku: editProduct.sku,
            name: editProduct.name,
            purchasePrice: String(editProduct.purchasePrice),
            sellingPrice: String(editProduct.sellingPrice),
            status: editProduct.status,
            parent: {
              sku: editProduct.parent.sku,
              name: editProduct.parent.name,
            },
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CreateProductForm />
        <CsvImportForm />
      </div>

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

                <Link
                  href={`/dashboard/products?${q ? `q=${encodeURIComponent(q)}&` : ""}edit=${product.id}`}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Edit
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Parent SKU</p>
                  <p className="font-medium text-slate-800">{product.parent.sku}</p>
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
                    ৳ {Number(product.purchasePrice).toFixed(2)}
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
                    ৳ {Number(product.purchasePrice).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    ৳ {Number(product.sellingPrice).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {product.status ? "Active" : "Inactive"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/dashboard/products?${q ? `q=${encodeURIComponent(q)}&` : ""}edit=${product.id}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Edit
                    </Link>
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