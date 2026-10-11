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
  getProductMediaStorageStatus,
} from "@/lib/product-media-storage";


type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    edit?: string;
    view?: string;
    section?: string;
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
  const requestedView = (params.view || "").trim();
  const requestedSection = (params.section || "").trim();
  const activeView = edit
    ? "edit"
    : requestedView === "create" || requestedView === "import"
      ? requestedView
      : "products";
  const editSection =
    requestedSection === "bundle" || requestedSection === "catalog"
      ? requestedSection
      : "inventory";
  const mediaStorageStatus = getProductMediaStorageStatus();
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
    <div className="space-y-5">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-950">Product Master</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Inventory + Catalog Hub
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Keep product inventory, bundle recipes and website publishing in one
              place without showing every tool at the same time.
            </p>
            {!canManageMaster ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Manager view: master-data create/edit/import is Admin-only. Stock
                operations remain available.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/stock-valuation"
              className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stock Valuation
            </Link>
            <Link
              href="/dashboard/products-purchases/local-purchase"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Local Purchase
            </Link>
            <Link
              href="/dashboard/stock-adjustments"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Adjust Stock
            </Link>
          </div>
        </div>
      </section>

      {activeView !== "edit" ? (
        <nav className="rounded-2xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Link
              href={q ? `/dashboard/products?q=${encodeURIComponent(q)}` : "/dashboard/products"}
              className={
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
                (activeView === "products"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100")
              }
            >
              Products
            </Link>

            {canManageMaster ? (
              <>
                <Link
                  href="/dashboard/products?view=create"
                  className={
                    "rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
                    (activeView === "create"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100")
                  }
                >
                  + Add Product
                </Link>
                <Link
                  href="/dashboard/products?view=import"
                  className={
                    "rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
                    (activeView === "import"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100")
                  }
                >
                  CSV Import
                </Link>
              </>
            ) : null}
          </div>
        </nav>
      ) : null}

      {activeView === "products" ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Find a Product
              </h2>
              <p className="text-xs text-slate-500">
                Search child SKU, product name, parent SKU or parent name.
              </p>
            </div>
            <p className="text-xs font-medium text-slate-400">
              Showing up to 100 results
            </p>
          </div>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="hidden"
              name="view"
              value="products"
            />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search SKU, product name or parent SKU..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
        </section>
      ) : null}

      {activeView === "create" && canManageMaster ? (
        <div className="mx-auto w-full max-w-5xl">
          <CreateProductForm />
        </div>
      ) : null}

      {activeView === "import" && canManageMaster ? (
        <div className="mx-auto w-full max-w-5xl">
          <CsvImportForm />
        </div>
      ) : null}

      {activeView === "edit" && canManageMaster ? (
        editProduct ? (
          <div className="space-y-5">
            <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <Link
                    href={q ? `/dashboard/products?q=${encodeURIComponent(q)}` : "/dashboard/products"}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    ← Back to Product List
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <h2 className="break-all text-xl font-bold text-slate-950">
                      {editProduct.sku}
                    </h2>
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-semibold " +
                        (editProduct.status
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600")
                      }
                    >
                      {editProduct.status ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {editProduct.inventoryKind === "BUNDLE"
                        ? "Virtual Bundle"
                        : editProduct.parent.stockMode === "PARENT_STOCK"
                          ? "Parent Stock"
                          : "Variation Stock"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {editProduct.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Parent: {editProduct.parent.sku} · Focus on one section at a time.
                  </p>
                </div>

                <Link
                  href={`/dashboard/stock-adjustments?q=${encodeURIComponent(editProduct.sku)}`}
                  className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Adjust This Stock
                </Link>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto border-t pt-4">
                <Link
                  href={`/dashboard/products?edit=${editProduct.id}&section=inventory${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={
                    "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold " +
                    (editSection === "inventory"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  Inventory & Basics
                </Link>
                <Link
                  href={`/dashboard/products?edit=${editProduct.id}&section=bundle${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={
                    "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold " +
                    (editSection === "bundle"
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  Bundle Recipe
                </Link>
                <Link
                  href={`/dashboard/products?edit=${editProduct.id}&section=catalog${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={
                    "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold " +
                    (editSection === "catalog"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  Website Content & Publishing
                </Link>
              </div>
            </section>

            {editSection === "inventory" ? (
              <EditProductForm
                product={{
                  id: editProduct.id,
                  sku: editProduct.sku,
                  name: editProduct.name,
                  quantity: editProduct.quantity,
                  unitsPerSale: editProduct.unitsPerSale,
                  inventoryKind: editProduct.inventoryKind,
                  stockVerified:
                    editProduct.parent.stockMode === "PARENT_STOCK"
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
            ) : null}

            {editSection === "bundle" ? (
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
            ) : null}

            {editSection === "catalog" ? (
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
                  previewUrl: mediaStorageStatus.configured
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
                bucketConfigured={mediaStorageStatus.configured}
                bucketMissingVariables={mediaStorageStatus.missingVariables}
                bucketInvalidVariables={mediaStorageStatus.invalidVariables}
              />
            ) : null}
          </div>
        ) : (
          <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-rose-700">Product not found</h2>
            <p className="mt-1 text-sm text-slate-500">
              This product may have been removed or the edit link is no longer valid.
            </p>
            <Link
              href="/dashboard/products"
              className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to Product List
            </Link>
          </section>
        )
      ) : null}

      {activeView === "products" ? (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Product List</h2>
              <p className="mt-1 text-sm text-slate-500">
                Open a product only when you need to edit inventory, bundle or website content.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {products.length} result{products.length === 1 ? "" : "s"}
            </span>
          </div>
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
                      href={`/dashboard/products?edit=${product.id}&section=inventory${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
                          href={`/dashboard/products?edit=${product.id}&section=inventory${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
      ) : null}
    </div>
  );
}