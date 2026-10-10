"use server";

import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { availableBundleSets, resolvePhysicalRequirements } from "@/lib/inventory";
import {
  createProductMediaDownloadUrl,
  deleteProductMediaObject,
} from "@/lib/product-media-storage";
import { prisma } from "@/lib/prisma";
import { enqueueFullSyncForProduct } from "@/lib/product-catalog-sync";

export type CatalogActionResult = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized.");
  }
}

function cleanOptional(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function nonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function unicodeSlug(value: unknown) {
  // Preserve Bangla / English / emoji / hyphens exactly. Only surrounding
  // whitespace and accidental leading/trailing route slashes are removed.
  return String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function refreshProductMaster() {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/integrations");
}

export async function saveProductCatalogContent(input: {
  productId: string;
  banglaName?: string;
  englishName?: string;
  productSlug?: string;
  shortDescriptionHtml?: string;
  fullDescriptionHtml?: string;
  oldPrice?: number | null;
  featured?: boolean;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
  externalVideoUrl?: string;
}): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const productId = String(input.productId || "").trim();
    if (!productId) return { success: false, message: "Product is required." };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) return { success: false, message: "Product not found." };

    const productSlug = unicodeSlug(input.productSlug);
    const sortOrder = Number.isSafeInteger(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : 0;

    await prisma.productCatalogContent.upsert({
      where: { productId },
      create: {
        productId,
        banglaName: cleanOptional(input.banglaName),
        englishName: cleanOptional(input.englishName),
        productSlug: productSlug || null,
        shortDescriptionHtml: cleanOptional(input.shortDescriptionHtml),
        fullDescriptionHtml: cleanOptional(input.fullDescriptionHtml),
        oldPrice: nonNegativeNumber(input.oldPrice),
        featured: Boolean(input.featured),
        sortOrder,
        metaTitle: cleanOptional(input.metaTitle),
        metaDescription: cleanOptional(input.metaDescription),
        externalVideoUrl: cleanOptional(input.externalVideoUrl),
      },
      update: {
        banglaName: cleanOptional(input.banglaName),
        englishName: cleanOptional(input.englishName),
        productSlug: productSlug || null,
        shortDescriptionHtml: cleanOptional(input.shortDescriptionHtml),
        fullDescriptionHtml: cleanOptional(input.fullDescriptionHtml),
        oldPrice: nonNegativeNumber(input.oldPrice),
        featured: Boolean(input.featured),
        sortOrder,
        metaTitle: cleanOptional(input.metaTitle),
        metaDescription: cleanOptional(input.metaDescription),
        externalVideoUrl: cleanOptional(input.externalVideoUrl),
      },
    });

    await enqueueFullSyncForProduct(prisma, productId);

    refreshProductMaster();
    return { success: true, message: "Product website content saved." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save product content.",
    };
  }
}

export async function saveProductWebsiteListing(input: {
  productId: string;
  integrationId: string;
  enabled: boolean;
  productSlugOverride?: string;
  sellingPriceOverride?: number | null;
  oldPriceOverride?: number | null;
  active?: boolean;
  featuredOverride?: boolean | null;
  taxonomyTermIds?: string[];
}): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const productId = String(input.productId || "").trim();
    const integrationId = String(input.integrationId || "").trim();

    const [product, integration] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }),
      prisma.integration.findUnique({
        where: { id: integrationId },
        select: { id: true, productSyncEnabled: true },
      }),
    ]);

    if (!product || !integration) {
      return { success: false, message: "Product or website integration not found." };
    }

    if (!input.enabled) {
      const current = await prisma.productWebsiteListing.findUnique({
        where: { productId_integrationId: { productId, integrationId } },
        select: { id: true, remoteProductId: true },
      });

      if (!current) {
        return { success: true, message: "Website was already unselected." };
      }

      if (current.remoteProductId) {
        await prisma.productWebsiteListing.update({
          where: { id: current.id },
          data: {
            active: false,
            syncStatus: "PENDING",
            lastSyncError: null,
          },
        });
        await prisma.productSyncJob.create({
          data: {
            productId,
            integrationId,
            listingId: current.id,
            operation: "UNPUBLISH",
          },
        });
      } else {
        await prisma.productWebsiteListing.delete({ where: { id: current.id } });
      }

      refreshProductMaster();
      return {
        success: true,
        message: current.remoteProductId
          ? "Website unpublish queued."
          : "Website removed from this product.",
      };
    }

    const taxonomyTermIds = Array.from(
      new Set((input.taxonomyTermIds || []).map(String).filter(Boolean))
    );

    if (taxonomyTermIds.length) {
      const validCount = await prisma.productWebsiteTaxonomyTerm.count({
        where: {
          id: { in: taxonomyTermIds },
          integrationId,
          active: true,
        },
      });
      if (validCount !== taxonomyTermIds.length) {
        return {
          success: false,
          message: "One or more selected categories/collections are invalid.",
        };
      }
    }

    const listing = await prisma.$transaction(async (tx) => {
      const row = await tx.productWebsiteListing.upsert({
        where: { productId_integrationId: { productId, integrationId } },
        create: {
          productId,
          integrationId,
          productSlugOverride: unicodeSlug(input.productSlugOverride) || null,
          sellingPriceOverride: nonNegativeNumber(input.sellingPriceOverride),
          oldPriceOverride: nonNegativeNumber(input.oldPriceOverride),
          active: input.active !== false,
          featuredOverride:
            input.featuredOverride === null ||
            input.featuredOverride === undefined
              ? null
              : Boolean(input.featuredOverride),
          syncStatus: "PENDING",
        },
        update: {
          productSlugOverride: unicodeSlug(input.productSlugOverride) || null,
          sellingPriceOverride: nonNegativeNumber(input.sellingPriceOverride),
          oldPriceOverride: nonNegativeNumber(input.oldPriceOverride),
          active: input.active !== false,
          featuredOverride:
            input.featuredOverride === null ||
            input.featuredOverride === undefined
              ? null
              : Boolean(input.featuredOverride),
          syncStatus: "PENDING",
          lastSyncError: null,
        },
      });

      await tx.productWebsiteTaxonomy.deleteMany({
        where: { listingId: row.id },
      });

      if (taxonomyTermIds.length) {
        await tx.productWebsiteTaxonomy.createMany({
          data: taxonomyTermIds.map((termId) => ({
            listingId: row.id,
            termId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.productSyncJob.create({
        data: {
          productId,
          integrationId,
          listingId: row.id,
          operation: "FULL_UPSERT",
        },
      });

      return row;
    });

    refreshProductMaster();

    return {
      success: true,
      message:
        "Website assignment saved" +
        (integration.productSyncEnabled
          ? ". Ready to publish."
          : ". Product Sync is disabled for this website."),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save website assignment.",
    };
  }
}

export async function registerProductMedia(input: {
  productId: string;
  kind: "IMAGE" | "VIDEO";
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  isPrimary?: boolean;
}): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const productId = String(input.productId || "").trim();
    const objectKey = String(input.objectKey || "").trim();
    const sizeBytes = Math.floor(Number(input.sizeBytes || 0));

    if (!productId || !objectKey || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      return { success: false, message: "Invalid uploaded media metadata." };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) return { success: false, message: "Product not found." };

    const currentCount = await prisma.productMedia.count({
      where: { productId, kind: input.kind },
    });

    const isPrimary =
      input.kind === "IMAGE" && (Boolean(input.isPrimary) || currentCount === 0);

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.productMedia.updateMany({
          where: { productId, kind: "IMAGE", isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.productMedia.create({
        data: {
          productId,
          kind: input.kind,
          objectKey,
          originalFileName: String(input.originalFileName || "media"),
          mimeType: String(input.mimeType || "application/octet-stream"),
          sizeBytes: BigInt(sizeBytes),
          checksum: cleanOptional(input.checksum),
          isPrimary,
          sortOrder: currentCount,
        },
      });

      await enqueueFullSyncForProduct(tx, productId);
    });

    refreshProductMaster();
    return { success: true, message: "Media uploaded and linked to Product Master." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to register product media.",
    };
  }
}

export async function setPrimaryProductImage(
  mediaId: string
): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const media = await prisma.productMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, productId: true, kind: true },
    });
    if (!media || media.kind !== "IMAGE") {
      return { success: false, message: "Image not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.productMedia.updateMany({
        where: { productId: media.productId, kind: "IMAGE" },
        data: { isPrimary: false },
      });
      await tx.productMedia.update({
        where: { id: media.id },
        data: { isPrimary: true },
      });
      await enqueueFullSyncForProduct(tx, media.productId);
    });

    refreshProductMaster();
    return { success: true, message: "Main product image updated." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update main image." };
  }
}

export async function deleteProductMedia(
  mediaId: string
): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const media = await prisma.productMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) return { success: false, message: "Media not found." };

    await deleteProductMediaObject(media.objectKey);

    await prisma.$transaction(async (tx) => {
      await tx.productMedia.delete({ where: { id: media.id } });
      if (media.isPrimary && media.kind === "IMAGE") {
        const next = await tx.productMedia.findFirst({
          where: { productId: media.productId, kind: "IMAGE" },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        if (next) {
          await tx.productMedia.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
      await enqueueFullSyncForProduct(tx, media.productId);
    });

    refreshProductMaster();
    return { success: true, message: "Media removed." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to delete media." };
  }
}

async function websiteStock(product: {
  id: string;
  inventoryKind: "PHYSICAL" | "BUNDLE";
  parent: unknown;
}) {
  if (product.inventoryKind === "BUNDLE") {
    return availableBundleSets(prisma, product);
  }

  const requirements = await resolvePhysicalRequirements(prisma, product, 1);
  const row = requirements[0];
  return row ? Math.max(0, Math.floor(row.available / row.requiredUnits)) : 0;
}

function catalogHeaders(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-OMS-Token": token,
  };
}

async function buildListingPayload(listingId: string) {
  const listing = await prisma.productWebsiteListing.findUnique({
    where: { id: listingId },
    include: {
      integration: true,
      product: {
        include: {
          parent: true,
          catalogContent: true,
          media: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
      taxonomyLinks: {
        include: { term: true },
      },
    },
  });

  if (!listing) throw new Error("Website listing not found.");
  if (!listing.integration.baseUrl || !listing.integration.catalogApiToken) {
    throw new Error("Website Base URL or Catalog API Token is missing.");
  }

  const content = listing.product.catalogContent;
  const stockQty = await websiteStock(listing.product);

  const media = listing.product.media.map((row) => ({
    id: row.id,
    kind: row.kind,
    isPrimary: row.isPrimary,
    sortOrder: row.sortOrder,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    checksum: row.checksum,
    downloadUrl: createProductMediaDownloadUrl(row.objectKey, 1800),
  }));

  const payload = {
    omsProductId: listing.product.id,
    parentSku: listing.product.parent.sku,
    sku: listing.product.sku,
    inventoryKind: listing.product.inventoryKind,
    stockQty,
    banglaName: content?.banglaName || null,
    englishName: content?.englishName || listing.product.name,
    productSlug:
      listing.productSlugOverride ||
      content?.productSlug ||
      listing.product.slug ||
      listing.product.sku,
    sellingPrice: Number(
      listing.sellingPriceOverride ?? listing.product.sellingPrice
    ),
    oldPrice:
      listing.oldPriceOverride !== null && listing.oldPriceOverride !== undefined
        ? Number(listing.oldPriceOverride)
        : content?.oldPrice !== null && content?.oldPrice !== undefined
          ? Number(content.oldPrice)
          : null,
    active: listing.active && listing.product.status,
    featured:
      listing.featuredOverride === null
        ? Boolean(content?.featured)
        : Boolean(listing.featuredOverride),
    sortOrder: content?.sortOrder || 0,
    shortDescriptionHtml: content?.shortDescriptionHtml || "",
    fullDescriptionHtml: content?.fullDescriptionHtml || "",
    metaTitle: content?.metaTitle || "",
    metaDescription: content?.metaDescription || "",
    externalVideoUrl: content?.externalVideoUrl || "",
    taxonomy: listing.taxonomyLinks.map(({ term }) => ({
      externalId: term.externalId,
      type: term.type,
      parentExternalId: term.parentExternalId,
      name: term.name,
      // raw Unicode slug; never percent encode or transliterate in JSON.
      slug: term.slug,
    })),
    media,
  };

  return { listing, payload };
}

export async function publishProductListing(
  listingId: string
): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const { listing, payload } = await buildListingPayload(listingId);
    if (!listing.integration.productSyncEnabled) {
      return {
        success: false,
        message: "Product Sync is disabled for " + listing.integration.name + ".",
      };
    }

    const job = await prisma.productSyncJob.create({
      data: {
        productId: listing.productId,
        integrationId: listing.integrationId,
        listingId: listing.id,
        operation: listing.active ? "FULL_UPSERT" : "UNPUBLISH",
        status: "RUNNING",
        attempts: 1,
        payloadHash: crypto
          .createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
      },
    });

    await prisma.productWebsiteListing.update({
      where: { id: listing.id },
      data: { syncStatus: "SYNCING", lastSyncError: null },
    });

    const endpoint =
      listing.integration.baseUrl +
      "/api/oms/v1/products/" +
      encodeURIComponent(listing.product.sku);

    const response = await fetch(
      listing.active
        ? endpoint
        : endpoint + "/unpublish",
      {
        method: listing.active ? "PUT" : "POST",
        headers: catalogHeaders(listing.integration.catalogApiToken!),
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      }
    );

    const raw = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }

    if (!response.ok) {
      const message =
        "HTTP " +
        response.status +
        (raw ? ": " + raw.slice(0, 350) : "");

      await prisma.$transaction([
        prisma.productWebsiteListing.update({
          where: { id: listing.id },
          data: { syncStatus: "FAILED", lastSyncError: message },
        }),
        prisma.productSyncJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            lastError: message,
            completedAt: new Date(),
          },
        }),
      ]);

      refreshProductMaster();
      return { success: false, message };
    }

    await prisma.$transaction([
      prisma.productWebsiteListing.update({
        where: { id: listing.id },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          lastSyncError: null,
          remoteProductId: body.externalProductId
            ? String(body.externalProductId)
            : listing.remoteProductId,
          publicUrl: body.publicUrl ? String(body.publicUrl) : listing.publicUrl,
        },
      }),
      prisma.productSyncJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date() },
      }),
    ]);

    refreshProductMaster();
    return {
      success: true,
      message: listing.product.sku + " synchronized to " + listing.integration.name + ".",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Product publishing failed.",
    };
  }
}

export async function applyCatalogImportCandidate(
  candidateId: string
): Promise<CatalogActionResult> {
  try {
    await requireAdmin();

    const candidate = await prisma.productCatalogImportCandidate.findUnique({
      where: { id: candidateId },
      include: { matchedProduct: true, integration: true },
    });

    if (!candidate || !candidate.matchedProductId) {
      return {
        success: false,
        message: "This website product is not matched to an OMS SKU.",
      };
    }

    const payload = JSON.parse(candidate.payloadJson) as Record<string, unknown>;

    const contentData = {
      banglaName: cleanOptional(payload.banglaName),
      englishName: cleanOptional(payload.englishName),
      productSlug: unicodeSlug(payload.productSlug) || null,
      shortDescriptionHtml: cleanOptional(payload.shortDescriptionHtml),
      fullDescriptionHtml: cleanOptional(payload.fullDescriptionHtml),
      oldPrice: nonNegativeNumber(payload.oldPrice),
      featured: Boolean(payload.featured),
      sortOrder: Number.isSafeInteger(Number(payload.sortOrder))
        ? Number(payload.sortOrder)
        : 0,
      metaTitle: cleanOptional(payload.metaTitle),
      metaDescription: cleanOptional(payload.metaDescription),
      externalVideoUrl: cleanOptional(payload.externalVideoUrl),
    };

    await prisma.$transaction(async (tx) => {
      await tx.productCatalogContent.upsert({
        where: { productId: candidate.matchedProductId! },
        create: {
          productId: candidate.matchedProductId!,
          ...contentData,
        },
        update: contentData,
      });

      await tx.productWebsiteListing.upsert({
        where: {
          productId_integrationId: {
            productId: candidate.matchedProductId!,
            integrationId: candidate.integrationId,
          },
        },
        create: {
          productId: candidate.matchedProductId!,
          integrationId: candidate.integrationId,
          remoteProductId: candidate.remoteProductId,
          productSlugOverride: unicodeSlug(payload.productSlug) || null,
          active: payload.active !== false,
          featuredOverride:
            typeof payload.featured === "boolean"
              ? Boolean(payload.featured)
              : null,
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
        },
        update: {
          remoteProductId: candidate.remoteProductId,
          productSlugOverride: unicodeSlug(payload.productSlug) || null,
          active: payload.active !== false,
          featuredOverride:
            typeof payload.featured === "boolean"
              ? Boolean(payload.featured)
              : null,
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
        },
      });

      await tx.productCatalogImportCandidate.update({
        where: { id: candidate.id },
        data: { status: "MATCHED" },
      });
    });

    refreshProductMaster();
    return {
      success: true,
      message:
        "Website content imported into OMS for SKU " +
        candidate.matchedProduct.sku +
        ". Inventory quantities were not changed.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to import website content.",
    };
  }
}
