import "server-only";

import crypto from "node:crypto";

import { availableBundleSets, resolvePhysicalRequirements } from "@/lib/inventory";
import { createProductMediaDownloadUrl } from "@/lib/product-media-storage";

function headers(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-OMS-Token": token,
  };
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

export async function buildProductListingPayload(listingId: string) {
  const { prisma } = await import("@/lib/prisma");
  const listing = await prisma.productWebsiteListing.findUnique({
    where: { id: listingId },
    include: {
      integration: true,
      product: {
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
      listing.oldPriceOverride !== null &&
      listing.oldPriceOverride !== undefined
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
      slug: term.slug,
    })),
    media: listing.product.media.map((row) => ({
      id: row.id,
      kind: row.kind,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      checksum: row.checksum,
      downloadUrl: createProductMediaDownloadUrl(row.objectKey, 1800),
    })),
  };

  return { listing, payload };
}

export async function syncProductListingNow(
  listingId: string,
  operation?: "FULL_UPSERT" | "STOCK_ONLY" | "UNPUBLISH",
  existingJobId?: string
) {
  const { prisma } = await import("@/lib/prisma");
  const { listing, payload } = await buildProductListingPayload(listingId);
  if (!listing.integration.productSyncEnabled) {
    throw new Error(
      "Product Sync is disabled for " + listing.integration.name + "."
    );
  }

  const effectiveOperation =
    operation || (listing.active ? "FULL_UPSERT" : "UNPUBLISH");

  const job = existingJobId
    ? await prisma.productSyncJob.findUnique({ where: { id: existingJobId } })
    : await prisma.productSyncJob.create({
        data: {
          productId: listing.productId,
          integrationId: listing.integrationId,
          listingId: listing.id,
          operation: effectiveOperation,
          status: "RUNNING",
          attempts: 1,
          payloadHash: crypto
            .createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("hex"),
        },
      });

  if (!job) throw new Error("Product sync job not found.");

  if (existingJobId) {
    await prisma.productSyncJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        lastError: null,
        payloadHash: crypto
          .createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
      },
    });
  }

  await prisma.productWebsiteListing.update({
    where: { id: listing.id },
    data: { syncStatus: "SYNCING", lastSyncError: null },
  });

  const baseEndpoint =
    listing.integration.baseUrl +
    "/api/oms/v1/products/" +
    encodeURIComponent(listing.product.sku);

  let url = baseEndpoint;
  let method = "PUT";
  let body: unknown = payload;

  if (effectiveOperation === "UNPUBLISH") {
    url = baseEndpoint + "/unpublish";
    method = "POST";
    body = {
      omsProductId: listing.product.id,
      sku: listing.product.sku,
      active: false,
    };
  } else if (effectiveOperation === "STOCK_ONLY") {
    url = baseEndpoint + "/stock";
    method = "PATCH";
    body = {
      omsProductId: listing.product.id,
      sku: listing.product.sku,
      stockQty: payload.stockQty,
    };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: headers(listing.integration.catalogApiToken!),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });

    const raw = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      result = {};
    }

    if (!response.ok) {
      throw new Error(
        "HTTP " +
          response.status +
          (raw ? ": " + raw.slice(0, 350) : "")
      );
    }

    await prisma.$transaction([
      prisma.productWebsiteListing.update({
        where: { id: listing.id },
        data: {
          syncStatus: effectiveOperation === "UNPUBLISH" ? "NOT_PUBLISHED" : "SYNCED",
          lastSyncedAt: new Date(),
          lastSyncError: null,
          remoteProductId: result.externalProductId
            ? String(result.externalProductId)
            : listing.remoteProductId,
          publicUrl: result.publicUrl
            ? String(result.publicUrl)
            : listing.publicUrl,
        },
      }),
      prisma.productSyncJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          lastError: null,
        },
      }),
    ]);

    return {
      success: true,
      message:
        listing.product.sku +
        " synchronized to " +
        listing.integration.name +
        ".",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website product sync failed.";
    const current = await prisma.productSyncJob.findUnique({
      where: { id: job.id },
      select: { attempts: true },
    });
    const attempts = current?.attempts || 1;
    const retryMinutes = Math.min(60, Math.max(5, attempts * 5));

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
          availableAt: new Date(Date.now() + retryMinutes * 60_000),
        },
      }),
    ]);

    throw new Error(message);
  }
}

export async function runPendingProductSyncJobs(limit = 8) {
  const { prisma } = await import("@/lib/prisma");
  const jobs = await prisma.productSyncJob.findMany({
    where: {
      listingId: { not: null },
      attempts: { lt: 5 },
      availableAt: { lte: new Date() },
      status: { in: ["PENDING", "FAILED"] },
      integration: {
        status: true,
        productSyncEnabled: true,
      },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(25, limit)),
    select: {
      id: true,
      listingId: true,
      operation: true,
      status: true,
      attempts: true,
    },
  });

  let successCount = 0;
  let failureCount = 0;

  for (const job of jobs) {
    if (!job.listingId) continue;

    const claimed = await prisma.productSyncJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
        attempts: job.attempts,
      },
      data: { status: "RUNNING" },
    });
    if (claimed.count !== 1) continue;

    try {
      await syncProductListingNow(
        job.listingId,
        job.operation,
        job.id
      );
      successCount += 1;
    } catch {
      failureCount += 1;
    }
  }

  return {
    processed: successCount + failureCount,
    successCount,
    failureCount,
  };
}

export async function enqueueFullSyncForProduct(
  tx: any,
  productId: string
) {
  const listings = await tx.productWebsiteListing.findMany({
    where: {
      productId,
      integration: {
        status: true,
        productSyncEnabled: true,
      },
    },
    select: {
      id: true,
      productId: true,
      integrationId: true,
      active: true,
    },
  });

  if (!listings.length) return 0;

  await tx.productSyncJob.createMany({
    data: listings.map((listing: any) => ({
      productId: listing.productId,
      integrationId: listing.integrationId,
      listingId: listing.id,
      operation: listing.active ? "FULL_UPSERT" : "UNPUBLISH",
    })),
  });

  await tx.productWebsiteListing.updateMany({
    where: { id: { in: listings.map((row: any) => row.id) } },
    data: {
      syncStatus: "PENDING",
      lastSyncError: null,
    },
  });

  return listings.length;
}

export async function enqueueStockSyncForOwners(
  tx: any,
  owners: Array<{
    ownerType: "PRODUCT" | "PRODUCT_PARENT";
    ownerId: string;
  }>
) {
  const productIds = new Set<string>();

  const productOwnerIds = Array.from(
    new Set(
      owners
        .filter((row) => row.ownerType === "PRODUCT")
        .map((row) => row.ownerId)
    )
  );
  const parentOwnerIds = Array.from(
    new Set(
      owners
        .filter((row) => row.ownerType === "PRODUCT_PARENT")
        .map((row) => row.ownerId)
    )
  );

  if (productOwnerIds.length) {
    for (const id of productOwnerIds) productIds.add(id);

    const bundleLinks = await tx.productBundleComponent.findMany({
      where: { componentProductId: { in: productOwnerIds } },
      select: { bundleProductId: true },
    });
    for (const row of bundleLinks) productIds.add(row.bundleProductId);
  }

  if (parentOwnerIds.length) {
    const siblings = await tx.product.findMany({
      where: { parentId: { in: parentOwnerIds } },
      select: { id: true },
    });
    const siblingIds = siblings.map((row: any) => row.id);
    for (const id of siblingIds) productIds.add(id);

    if (siblingIds.length) {
      const bundleLinks = await tx.productBundleComponent.findMany({
        where: { componentProductId: { in: siblingIds } },
        select: { bundleProductId: true },
      });
      for (const row of bundleLinks) productIds.add(row.bundleProductId);
    }
  }

  return enqueueStockSyncForProducts(tx, Array.from(productIds));
}

export async function enqueueStockSyncForProducts(
  tx: any,
  productIds: string[]
) {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return 0;

  const listings = await tx.productWebsiteListing.findMany({
    where: {
      productId: { in: ids },
      integration: {
        status: true,
        productSyncEnabled: true,
      },
    },
    select: {
      id: true,
      productId: true,
      integrationId: true,
    },
  });

  if (!listings.length) return 0;

  await tx.productSyncJob.createMany({
    data: listings.map((listing: any) => ({
      productId: listing.productId,
      integrationId: listing.integrationId,
      listingId: listing.id,
      operation: "STOCK_ONLY",
    })),
  });

  await tx.productWebsiteListing.updateMany({
    where: { id: { in: listings.map((row: any) => row.id) } },
    data: { syncStatus: "PENDING" },
  });

  return listings.length;
}
