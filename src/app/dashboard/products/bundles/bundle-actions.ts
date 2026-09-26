"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";

export type BundleRecipeState = { success: boolean; message: string };

export async function saveBundleRecipe(
  _state: BundleRecipeState,
  formData: FormData
): Promise<BundleRecipeState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, message: "Only Admin can configure bundle recipes." };
    }

    const productId = String(formData.get("productId") || "").trim();
    const confirm = formData.get("confirmLegacyStock") === "yes";
    const raw = String(formData.get("recipeJson") || "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 30) {
      return { success: false, message: "Add 1–30 physical SKU components." };
    }

    const components = parsed.map((line: any) => ({
      componentProductId: String(line.componentProductId || "").trim(),
      units: Number(line.units),
    }));
    const ids = components.map((part) => part.componentProductId);
    if (
      components.some((part) =>
        !part.componentProductId ||
        !Number.isSafeInteger(part.units) ||
        part.units < 1 ||
        part.units > 10000
      ) ||
      ids.length !== new Set(ids).size
    ) {
      return {
        success: false,
        message: "Choose distinct physical SKUs with whole-number quantities above zero.",
      };
    }

    const { prisma } = await import("@/lib/prisma");
    const bundle = await prisma.product.findUnique({
      where: { id: productId },
      include: { parent: true },
    });
    if (!bundle) return { success: false, message: "Selling SKU not found." };
    if (!bundle.status) {
      return { success: false, message: "Activate this selling SKU before configuring it." };
    }
    if (bundle.parent.stockMode !== "VARIANT_STOCK") {
      return {
        success: false,
        message: "Colour/component inventory must be Variation Stock. Parent Stock cannot track separate colour quantities.",
      };
    }
    if (
      bundle.inventoryKind !== "BUNDLE" &&
      Number(bundle.quantity) !== 0 &&
      !confirm
    ) {
      return {
        success: false,
        message: "Acknowledge the existing SKU quantity before converting it. It will be preserved but excluded from physical stock.",
      };
    }

    const [physical, usedAsComponent] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sku: true,
          parentId: true,
          parent: { select: { stockMode: true } },
          inventoryKind: true,
          status: true,
        },
      }),
      prisma.productBundleComponent.count({
        where: { componentProductId: productId },
      }),
    ]);

    if (usedAsComponent) {
      return {
        success: false,
        message: "This SKU is already used as a physical component in another bundle.",
      };
    }

    if (
      physical.length !== ids.length ||
      physical.some((row) =>
        !row.status ||
        row.inventoryKind !== "PHYSICAL" ||
        row.parent.stockMode !== "VARIANT_STOCK" ||
        row.id === bundle.id
      )
    ) {
      return {
        success: false,
        message: "Every component must be a distinct active physical Variation Stock SKU. Components may belong to different colour parents.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: bundle.id },
        data: { inventoryKind: "BUNDLE" },
      });
      await tx.productBundleComponent.deleteMany({
        where: { bundleProductId: bundle.id },
      });
      await tx.productBundleComponent.createMany({
        data: components.map((row) => ({
          bundleProductId: bundle.id,
          componentProductId: row.componentProductId,
          units: row.units,
        })),
      });
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/bundles");
    revalidatePath("/dashboard/stock-valuation");
    revalidatePath("/dashboard/damage-products");
    revalidatePath("/dashboard/stock-adjustments");
    return {
      success: true,
      message: "Bundle recipe saved. Physical stock is unchanged. New courier submissions will consume these components; previous submissions retain their original stock snapshots.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save bundle recipe.",
    };
  }
}
