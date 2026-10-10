import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import CreateProductForm from "./create-product-form";
import CsvImportForm from "./csv-import-form";
import EditProductForm from "./edit-product-form";
import ProductCatalogEditor from "./product-catalog-editor";
import BundleRecipeEditor from "./bundles/bundle-recipe-editor";
import {
  createProductMediaDownloadUrl,
  productMediaStorageConfigured,
} from "@/lib/product-media-storage";


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

  const [products, editProduct, integrations, componentOptions, importCandidates] =
    await Promise.all([
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
              catalogContent: true,
              media: {
                orderBy: [
                  { isPrimary: "desc" },
                  { sortOrder: "asc" },
                  { createdAt: "asc" },
                ],
              },
              bundleComponents: true,
              websiteListings: {
                include: {
                  taxonomyLinks: true,
                },
              },
            },
          })
        : null,
      canManageMaster
        ? prisma.integration.findMany({
            where: { status: true },
            orderBy: { name: "asc" },
            include: {
              taxonomyTerms: {
                where: { active: true },
                orderBy: [{ type: "asc" }, { name: "asc" }],
              },
            },
          })
        : [],
      edit && canManageMaster
        ? prisma.product.findMany({
            where: {
              inventoryKind: "PHYSICAL",
              status: true,
              parent: { stockMode: "VARIANT_STOCK" },
              NOT: { id: edit },
            },
            orderBy: { sku: "asc" },
            select: {
              id: true,
              sku: true,
              name: true,
              quantity: true,
              purchasePrice: true,
            },
          })
        : [],
      edit && canManageMaster
        ? prisma.productCatalogImportCandidate.findMany({
            where: {
              matchedProductId: edit,
            },
            include: {
              integration: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        : [],
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
  function stockVerified(product: (typeof products)[number]) {
    return product.inventoryKind === "BUNDLE"
      ? product.bundleComponents.length > 0 &&
        product.bundleComponents.every((part) =>
          Boolean(part.componentProduct.stockVerifiedAt)
        )
      : product.parent.stockMode === "PARENT_STOCK"
        ? Boolean(product.parent.stockVerifiedAt)
        : Boolean(product.stockVerifiedAt);
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
              Manage parent and variation inventory. Old balances stay unverified
              until an exact physical count is entered; unverified quantities
              are excluded from Stock Valuation.
            </p>
            {!canManageMaster ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Manager view: master-data create/edit/import is Admin-only. Stock adjustment is available.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/products-purchases/local-purchase"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
              Local Purchase
            </Link>
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
        <>
          <EditProductForm
            product={{
              id: editProduct.id,
              sku: editProduct.sku,
              name: editProduct.name,
              quantity: editProduct.quantity,
              unitsPerSale: editProduct.unitsPerSale,
              inventoryKind: editProduct.inventoryKind,
              stockVerified: editProduct.parent.stockMode === "PARENT_STOCK"
                ? Boolean(editProduct.parent.stockVerifiedAt)
                : Boolean(editProduct.stockVerifiedAt),
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

          <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-950">
                Bundle / Composite Recipe
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bundle Recipes are now part of Product Master. A bundle has no
                independent physical stock or valuation; availability comes from
                its physical component SKUs.
              </p>
            </div>
            <BundleRecipeEditor
              product={{
                id: editProduct.id,
                sku: editProduct.sku,
                name: editProduct.name,
                parentSku: editProduct.parent.sku,
                mode: editProduct.parent.stockMode,
                kind: editProduct.inventoryKind,
                legacyQuantity: editProduct.quantity,
                existing: editProduct.bundleComponents.map((part) => ({
                  componentProductId: part.componentProductId,
                  units: part.units,
                })),
              }}
              options={componentOptions.map((option) => ({
                id: option.id,
                sku: option.sku,
                name: option.name,
                quantity: option.quantity,
                cost: Number(option.purchasePrice),
              }))}
            />
          </section>

          <ProductCatalogEditor
            product={{
              id: editProduct.id,
              sku: editProduct.sku,
              name: editProduct.name,
              sellingPrice: Number(editProduct.sellingPrice),
              content: {
                banglaName: editProduct.catalogContent?.banglaName || "",
                englishName:
                  editProduct.catalogContent?.englishName || editProduct.name,
                productSlug:
                  editProduct.catalogContent?.productSlug ||
                  editProduct.slug ||
                  "",
                shortDescriptionHtml:
                  editProduct.catalogContent?.shortDescriptionHtml || "",
                fullDescriptionHtml:
                  editProduct.catalogContent?.fullDescriptionHtml || "",
                oldPrice:
                  editProduct.catalogContent?.oldPrice !== null &&
                  editProduct.catalogContent?.oldPrice !== undefined
                    ? Number(editProduct.catalogContent.oldPrice)
                    : null,
                featured: Boolean(editProduct.catalogContent?.featured),
                sortOrder: editProduct.catalogContent?.sortOrder || 0,
                metaTitle: editProduct.catalogContent?.metaTitle || "",
                metaDescription:
                  editProduct.catalogContent?.metaDescription || "",
                externalVideoUrl:
                  editProduct.catalogContent?.externalVideoUrl || "",
              },
            }}
            websites={integrations.map((integration) => {
              const listing = editProduct.websiteListings.find(
                (row) => row.integrationId === integration.id
              );
              return {
                id: integration.id,
                name: integration.name,
                platform: integration.platform,
                catalogMode: integration.catalogMode,
                productSyncEnabled: integration.productSyncEnabled,
                baseUrl: integration.baseUrl,
                taxonomyTerms: integration.taxonomyTerms.map((term) => ({
                  id: term.id,
                  externalId: term.externalId,
                  type: term.type,
                  parentExternalId: term.parentExternalId,
                  name: term.name,
                  slug: term.slug,
                })),
                listing: listing
                  ? {
                      id: listing.id,
                      productSlugOverride: listing.productSlugOverride,
                      sellingPriceOverride:
                        listing.sellingPriceOverride !== null
                          ? Number(listing.sellingPriceOverride)
                          : null,
                      oldPriceOverride:
                        listing.oldPriceOverride !== null
                          ? Number(listing.oldPriceOverride)
                          : null,
                      active: listing.active,
                      featuredOverride: listing.featuredOverride,
                      remoteProductId: listing.remoteProductId,
                      publicUrl: listing.publicUrl,
                      syncStatus: listing.syncStatus,
                      lastSyncedAt: listing.lastSyncedAt
                        ? listing.lastSyncedAt.toISOString()
                        : null,
                      lastSyncError: listing.lastSyncError,
                      taxonomyTermIds: listing.taxonomyLinks.map(
                        (link) => link.termId
                      ),
                    }
                  : null,
              };
            })}
            media={editProduct.media.map((row) => ({
              id: row.id,
              kind: row.kind,
              originalFileName: row.originalFileName,
              mimeType: row.mimeType,
              sizeBytes: Number(row.sizeBytes),
              isPrimary: row.isPrimary,
              sortOrder: row.sortOrder,
              previewUrl: productMediaStorageConfigured()
                ? createProductMediaDownloadUrl(row.objectKey, 1800)
                : null,
            }))}
            importCandidates={importCandidates.map((candidate) => ({
              id: candidate.id,
              websiteName: candidate.integration.name,
              externalProductId: candidate.remoteProductId,
              status: candidate.status,
              updatedAt: candidate.updatedAt.toISOString(),
            }))}
            bucketConfigured={productMediaStorageConfigured()}
          />
        </>
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
                  {!stockVerified(product) ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Legacy / unverified — excluded from valuation
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Verified physical count
                    </p>
                  )}
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
                    <div className={"mt-1 text-xs font-semibold " +
                      (stockVerified(product)
                        ? "text-emerald-700"
                        : "text-amber-700")}>
                      {stockVerified(product) ? "Verified" : "Unverified / not valued"}
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