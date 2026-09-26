import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import BundleRecipeEditor from "./bundle-recipe-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams?: Promise<{ q?: string; componentQ?: string }> };

export default async function BundleRecipesPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const q = String((await searchParams)?.q || "").trim();
  const { prisma } = await import("@/lib/prisma");
  const products = q
    ? await prisma.product.findMany({
        where: {
          OR: [
            { sku: { contains: q } },
            { name: { contains: q } },
            { parent: { sku: { contains: q } } },
          ],
        },
        include: { parent: true, bundleComponents: true },
        orderBy: { sku: "asc" },
        take: 40,
      })
    : [];

  const referencedIds = [...new Set(products.flatMap((product) =>
    product.bundleComponents.map((part) => part.componentProductId)
  ))];
  const componentQuery = String((await searchParams)?.componentQ || q).trim();
  const choices = q
    ? await prisma.product.findMany({
        where: {
          inventoryKind: "PHYSICAL",
          status: true,
          parent: { stockMode: "VARIANT_STOCK" },
          OR: [
            { sku: { contains: componentQuery } },
            { name: { contains: componentQuery } },
            { parent: { sku: { contains: componentQuery } } },
            { id: { in: referencedIds } },
          ],
        },
        orderBy: { sku: "asc" },
        take: 350,
      })
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bundle / Composite SKU Recipes</h1>
            <p className="mt-1 text-sm text-slate-600">
              A selling SKU can consume multiple physical colour SKUs from different colour parent codes.
            </p>
          </div>
          <Link href="/dashboard/products" className="rounded-xl border px-4 py-2 text-sm font-semibold">
            Back to Product Master
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Do not add old Black-2pcs/Black-3pcs stock to Black-1pcs automatically.
          First verify the actual physical count of each colour. Virtual bundles
          have no independent stock value; their availability and cost are derived from components.
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search child SKU or Parent Code (e.g. Code-GF-254)"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm"
          />
          <input
            name="componentQ"
            defaultValue={String((await searchParams)?.componentQ || "")}
            placeholder="Physical component search (optional)"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm"
          />
          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Find SKUs
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {products.map((product) => (
          <BundleRecipeEditor
            key={product.id}
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              parentSku: product.parent.sku,
              mode: product.parent.stockMode,
              kind: product.inventoryKind,
              legacyQuantity: product.quantity,
              existing: product.bundleComponents.map((part) => ({
                componentProductId: part.componentProductId,
                units: part.units,
              })),
            }}
            options={choices.map((option) => ({
                id: option.id,
                sku: option.sku,
                name: option.name,
                quantity: option.quantity,
                cost: Number(option.purchasePrice),
              }))}
          />
        ))}
        {!q ? (
          <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
            Search for the product family to configure recipes.
          </p>
        ) : !products.length ? (
          <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
            No Product Master SKU matches this search.
          </p>
        ) : null}
      </section>
    </div>
  );
}
