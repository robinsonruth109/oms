"use server";

import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createProductMediaObjectKey,
  deleteProductMediaObject,
  uploadProductMediaObject,
} from "@/lib/product-media-storage";

export type ActionState = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateApiKey() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizedSkuKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("en-US");
}

function catalogHeaders(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-OMS-Token": token,
  };
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function nonNegativeMoney(value: unknown) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  const amount = Number(raw || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function productNameFromWebsite(
  payload: Record<string, unknown>,
  sku: string
) {
  return (
    optionalText(payload.englishName) ||
    optionalText(payload.banglaName) ||
    optionalText(payload.name) ||
    sku
  );
}

function productInternalSlug(sku: string) {
  return sku.trim().toLowerCase();
}

function absolutizeHtmlMediaUrls(value: unknown, baseUrl: string) {
  const html = String(value ?? "");
  if (!html.trim()) return "";

  const base = normalizeBaseUrl(baseUrl) + "/";
  return html.replace(
    /\b(src|poster)\s*=\s*(["'])(.*?)\2/gi,
    (full, attr: string, quote: string, rawUrl: string) => {
      const url = String(rawUrl || "").trim();
      if (
        !url ||
        /^(?:https?:|data:|blob:|mailto:|tel:|#)/i.test(url)
      ) {
        return full;
      }

      try {
        return attr + "=" + quote + new URL(url, base).toString() + quote;
      } catch {
        return full;
      }
    }
  );
}

function remoteTaxonomyRows(payload: Record<string, unknown>) {
  return Array.isArray(payload.taxonomy)
    ? payload.taxonomy.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object"
      )
    : [];
}

function remoteMediaRows(payload: Record<string, unknown>) {
  return Array.isArray(payload.media)
    ? payload.media.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object"
      )
    : [];
}

async function importRemoteMediaForExistingProduct(input: {
  productId: string;
  payload: Record<string, unknown>;
}) {
  const rows = remoteMediaRows(input.payload);
  if (!rows.length) {
    return { importedImages: 0, importedVideos: 0 };
  }

  const [imageCount, videoCount] = await Promise.all([
    prisma.productMedia.count({
      where: { productId: input.productId, kind: "IMAGE" },
    }),
    prisma.productMedia.count({
      where: { productId: input.productId, kind: "VIDEO" },
    }),
  ]);

  const wanted = rows
    .map((row, index) => ({
      row,
      index,
      kind: String(row.kind || "").toUpperCase(),
      url: String(row.url || "").trim(),
      isPrimary: Boolean(row.isPrimary),
      sortOrder: Number.isSafeInteger(Number(row.sortOrder))
        ? Number(row.sortOrder)
        : index,
    }))
    .filter(({ kind, url }) => {
      if (!url || !["IMAGE", "VIDEO"].includes(kind)) return false;
      if (kind === "IMAGE" && imageCount > 0) return false;
      if (kind === "VIDEO" && videoCount > 0) return false;
      return true;
    });

  if (!wanted.length) {
    return { importedImages: 0, importedVideos: 0 };
  }

  const uploaded: Array<{
    objectKey: string;
    kind: "IMAGE" | "VIDEO";
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    isPrimary: boolean;
    sortOrder: number;
  }> = [];

  try {
    for (const item of wanted) {
      const response = await fetch(item.url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(
          "Website media download failed with HTTP " +
            response.status +
            ": " +
            item.url
        );
      }

      const buffer = await response.arrayBuffer();
      const sizeBytes = buffer.byteLength;
      const maxBytes = item.kind === "VIDEO" ? 60 * 1024 * 1024 : 12 * 1024 * 1024;

      if (sizeBytes <= 0 || sizeBytes > maxBytes) {
        throw new Error(
          "Website " +
            item.kind.toLowerCase() +
            " is outside the OMS upload limit: " +
            item.url
        );
      }

      const urlPath = (() => {
        try {
          return new URL(item.url).pathname;
        } catch {
          return "";
        }
      })();

      const fallbackName =
        item.kind === "VIDEO"
          ? "website-video.mp4"
          : "website-image.jpg";
      const originalFileName =
        optionalText(item.row.originalFileName) ||
        (urlPath ? decodeURIComponent(urlPath.split("/").pop() || "") : "") ||
        fallbackName;
      const mimeType =
        optionalText(item.row.mimeType) ||
        response.headers.get("content-type")?.split(";")[0]?.trim() ||
        (item.kind === "VIDEO" ? "video/mp4" : "image/jpeg");
      const checksum = crypto
        .createHash("sha256")
        .update(Buffer.from(buffer))
        .digest("hex");

      const objectKey = createProductMediaObjectKey({
        productId: input.productId,
        kind: item.kind as "IMAGE" | "VIDEO",
        originalFileName,
      });

      await uploadProductMediaObject({
        objectKey,
        body: buffer,
        contentType: mimeType,
        contentLength: sizeBytes,
      });

      uploaded.push({
        objectKey,
        kind: item.kind as "IMAGE" | "VIDEO",
        originalFileName,
        mimeType,
        sizeBytes,
        checksum,
        isPrimary: item.kind === "IMAGE" && item.isPrimary,
        sortOrder: item.sortOrder,
      });
    }

    const imageRows = uploaded.filter((row) => row.kind === "IMAGE");
    const hasExplicitPrimary = imageRows.some((row) => row.isPrimary);

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < uploaded.length; index += 1) {
        const row = uploaded[index];
        await tx.productMedia.create({
          data: {
            productId: input.productId,
            kind: row.kind,
            objectKey: row.objectKey,
            originalFileName: row.originalFileName,
            mimeType: row.mimeType,
            sizeBytes: BigInt(row.sizeBytes),
            checksum: row.checksum,
            isPrimary:
              row.kind === "IMAGE" &&
              (row.isPrimary || (!hasExplicitPrimary && index === 0)),
            sortOrder: row.sortOrder,
          },
        });
      }
    });

    return {
      importedImages: uploaded.filter((row) => row.kind === "IMAGE").length,
      importedVideos: uploaded.filter((row) => row.kind === "VIDEO").length,
    };
  } catch (error) {
    for (const row of uploaded) {
      await deleteProductMediaObject(row.objectKey).catch(() => undefined);
    }
    throw error;
  }
}

async function getCatalogIntegration(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) throw new Error("Integration not found.");
  if (!integration.baseUrl || !integration.catalogApiToken) {
    throw new Error(
      "Set Website Base URL and Catalog API Token before using product sync."
    );
  }

  return integration;
}

export async function createIntegration(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const slug = normalizeSlug(String(formData.get("slug") || "").trim());
    const platform = String(formData.get("platform") || "").trim();
    const sourceId = String(formData.get("sourceId") || "").trim();
    const webhookSecret = String(formData.get("webhookSecret") || "").trim();
    const catalogMode =
      String(formData.get("catalogMode") || "SUBCATEGORY") === "COLLECTION"
        ? "COLLECTION"
        : "SUBCATEGORY";
    const baseUrl = normalizeBaseUrl(String(formData.get("baseUrl") || ""));
    const catalogApiToken = String(formData.get("catalogApiToken") || "").trim();
    const productSyncEnabled =
      String(formData.get("productSyncEnabled") || "") === "true";

    if (!name || !slug || !platform || !sourceId) {
      return {
        success: false,
        message: "Name, slug, platform and source are required.",
      };
    }

    if (!["SHOPIFY", "LARAVEL"].includes(platform)) {
      return {
        success: false,
        message: "Invalid platform selected.",
      };
    }

    const [existingSlug, source] = await Promise.all([
      prisma.integration.findUnique({
        where: { slug },
      }),
      prisma.orderSource.findUnique({
        where: { id: sourceId },
      }),
    ]);

    if (existingSlug) {
      return {
        success: false,
        message: "This slug already exists.",
      };
    }

    if (!source) {
      return {
        success: false,
        message: "Selected source not found.",
      };
    }

    await prisma.integration.create({
      data: {
        name,
        slug,
        platform: platform as "SHOPIFY" | "LARAVEL",
        sourceId,
        apiKey: generateApiKey(),
        webhookSecret: webhookSecret || null,
        catalogMode,
        baseUrl: baseUrl || null,
        catalogApiToken: catalogApiToken || null,
        productSyncEnabled: Boolean(
          productSyncEnabled && baseUrl && catalogApiToken
        ),
        status: true,
      },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "Integration created successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to create integration.",
    };
  }
}

export async function toggleIntegrationStatus(
  integrationId: string,
  nextStatus: boolean
): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: nextStatus },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "Integration status updated.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to update integration status.",
    };
  }
}

export async function regenerateIntegrationApiKey(
  integrationId: string
): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        apiKey: generateApiKey(),
      },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "API key regenerated successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to regenerate API key.",
    };
  }
}

export async function updateIntegrationCatalogSettings(input: {
  integrationId: string;
  platform: "LARAVEL" | "SHOPIFY";
  catalogMode: "COLLECTION" | "SUBCATEGORY";
  baseUrl: string;
  catalogApiToken?: string;
  productSyncEnabled: boolean;
}): Promise<ActionState> {
  try {
    await requireAdmin();

    const integrationId = String(input.integrationId || "").trim();
    const platform = input.platform === "SHOPIFY" ? "SHOPIFY" : "LARAVEL";
    const catalogMode =
      input.catalogMode === "COLLECTION" ? "COLLECTION" : "SUBCATEGORY";
    const baseUrl = normalizeBaseUrl(input.baseUrl || "");
    const token = String(input.catalogApiToken || "").trim();

    if (!integrationId) {
      return { success: false, message: "Integration is required." };
    }

    const current = await prisma.integration.findUnique({
      where: { id: integrationId },
      select: { id: true, catalogApiToken: true },
    });
    if (!current) {
      return { success: false, message: "Integration not found." };
    }

    const effectiveToken = token || current.catalogApiToken || null;
    if (input.productSyncEnabled && (!baseUrl || !effectiveToken)) {
      return {
        success: false,
        message:
          "Base URL and Catalog API Token are required before Product Sync can be enabled.",
      };
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        platform,
        catalogMode,
        baseUrl: baseUrl || null,
        ...(token ? { catalogApiToken: token } : {}),
        productSyncEnabled: input.productSyncEnabled,
      },
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Website catalog settings updated.",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}

export async function testIntegrationCatalogConnection(
  integrationId: string
): Promise<ActionState> {
  try {
    await requireAdmin();
    const integration = await getCatalogIntegration(integrationId);

    const response = await fetch(
      integration.baseUrl + "/api/oms/v1/ping",
      {
        method: "GET",
        headers: catalogHeaders(integration.catalogApiToken!),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      }
    );

    const text = await response.text();
    if (!response.ok) {
      return {
        success: false,
        message:
          "Website responded " +
          response.status +
          (text ? ": " + text.slice(0, 180) : ""),
      };
    }

    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    const storeName =
      data &&
      typeof data === "object" &&
      "storeName" in data &&
      typeof (data as { storeName?: unknown }).storeName === "string"
        ? (data as { storeName: string }).storeName
        : integration.name;

    return {
      success: true,
      message: "Connected successfully to " + storeName + ".",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}

type RemoteTaxonomyTerm = {
  externalId: string;
  type: "CATEGORY" | "SUBCATEGORY" | "COLLECTION";
  parentExternalId?: string | null;
  name: string;
  slug: string;
  active?: boolean;
};

export async function syncIntegrationTaxonomy(
  integrationId: string
): Promise<ActionState> {
  try {
    await requireAdmin();
    const integration = await getCatalogIntegration(integrationId);

    const response = await fetch(
      integration.baseUrl + "/api/oms/v1/taxonomy",
      {
        method: "GET",
        headers: catalogHeaders(integration.catalogApiToken!),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }
    );

    const raw = await response.text();
    if (!response.ok) {
      return {
        success: false,
        message:
          "Taxonomy sync failed with HTTP " +
          response.status +
          (raw ? ": " + raw.slice(0, 180) : ""),
      };
    }

    const body = JSON.parse(raw) as {
      success?: boolean;
      catalogMode?: string;
      terms?: RemoteTaxonomyTerm[];
    };
    const terms = Array.isArray(body.terms) ? body.terms : [];

    const cleanTerms = terms
      .map((term) => ({
        externalId: String(term.externalId || "").trim(),
        type: String(term.type || "").toUpperCase(),
        parentExternalId: term.parentExternalId
          ? String(term.parentExternalId)
          : null,
        name: String(term.name || "").trim(),
        // IMPORTANT: raw Unicode slug is intentionally not transliterated,
        // lowercased or regenerated.
        slug: String(term.slug || "").trim().replace(/^\/+|\/+$/g, ""),
        active: term.active !== false,
      }))
      .filter(
        (term) =>
          term.externalId &&
          term.name &&
          term.slug &&
          ["CATEGORY", "SUBCATEGORY", "COLLECTION"].includes(term.type)
      );

    await prisma.$transaction(async (tx) => {
      for (const term of cleanTerms) {
        await tx.productWebsiteTaxonomyTerm.upsert({
          where: {
            integrationId_type_externalId: {
              integrationId,
              type: term.type as
                | "CATEGORY"
                | "SUBCATEGORY"
                | "COLLECTION",
              externalId: term.externalId,
            },
          },
          create: {
            integrationId,
            externalId: term.externalId,
            type: term.type as
              | "CATEGORY"
              | "SUBCATEGORY"
              | "COLLECTION",
            parentExternalId: term.parentExternalId,
            name: term.name,
            slug: term.slug,
            active: term.active,
          },
          update: {
            parentExternalId: term.parentExternalId,
            name: term.name,
            slug: term.slug,
            active: term.active,
          },
        });
      }

      await tx.integration.update({
        where: { id: integrationId },
        data: {
          lastTaxonomySyncAt: new Date(),
          ...(body.catalogMode === "COLLECTION" ||
          body.catalogMode === "SUBCATEGORY"
            ? {
                catalogMode: body.catalogMode as
                  | "COLLECTION"
                  | "SUBCATEGORY",
              }
            : {}),
        },
      });
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message:
        "Taxonomy synchronized. " +
        cleanTerms.length +
        " category/collection record(s) received.",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}

type RemoteCatalogProduct = {
  externalProductId: string | number;
  sku: string;
  [key: string]: unknown;
};

export async function importIntegrationCatalog(
  integrationId: string
): Promise<ActionState> {
  try {
    await requireAdmin();
    const integration = await getCatalogIntegration(integrationId);

    let cursor = "";
    let pages = 0;
    let received = 0;
    let matched = 0;
    let pending = 0;

    while (pages < 20) {
      const url = new URL(
        integration.baseUrl + "/api/oms/v1/products"
      );
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url.toString(), {
        headers: catalogHeaders(integration.catalogApiToken!),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });

      const raw = await response.text();
      if (!response.ok) {
        return {
          success: false,
          message:
            "Catalog import failed with HTTP " +
            response.status +
            (raw ? ": " + raw.slice(0, 180) : ""),
        };
      }

      const body = JSON.parse(raw) as {
        items?: RemoteCatalogProduct[];
        nextCursor?: string | null;
      };
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) break;

      const remoteSkus = Array.from(
        new Set(items.map((item) => String(item.sku || "").trim()).filter(Boolean))
      );

      // SKU matching is compatibility-normalized so visually decorated Unicode
      // text such as "𝐏𝐀𝐒𝐓𝐄𝐋" matches the plain-text SKU "PASTEL".
      // The original SKU is still preserved for display/storage.
      const products = remoteSkus.length
        ? await prisma.product.findMany({
            select: { id: true, sku: true },
          })
        : [];

      const productIdsByNormalizedSku = new Map<string, string[]>();
      for (const product of products) {
        const key = normalizedSkuKey(product.sku);
        const ids = productIdsByNormalizedSku.get(key) || [];
        ids.push(product.id);
        productIdsByNormalizedSku.set(key, ids);
      }

      const productByNormalizedSku = new Map<string, string>();
      for (const [key, ids] of productIdsByNormalizedSku.entries()) {
        // Only auto-match when the normalized SKU identifies exactly one OMS
        // product. Existing duplicate-equivalent OMS SKUs require manual review.
        if (ids.length === 1) {
          productByNormalizedSku.set(key, ids[0]);
        }
      }

      const preparedRows = items
        .map((item) => {
          const sku = String(item.sku || "").trim();
          const remoteProductId = String(item.externalProductId || "").trim();
          if (!sku || !remoteProductId) return null;

          return {
            item,
            sku,
            remoteProductId,
            matchedProductId:
              productByNormalizedSku.get(normalizedSkuKey(sku)) || null,
          };
        })
        .filter(
          (
            row
          ): row is {
            item: RemoteCatalogProduct;
            sku: string;
            remoteProductId: string;
            matchedProductId: string | null;
          } => Boolean(row)
        );

      received += preparedRows.length;
      matched += preparedRows.filter((row) => row.matchedProductId).length;
      pending += preparedRows.filter((row) => !row.matchedProductId).length;

      // Do not keep one interactive transaction open while scanning an entire
      // remote page. A 100-product page can require ~200 upserts and exceeded
      // Prisma's default 5-second interactive transaction timeout.
      //
      // Small array-transactions keep each batch atomic without the interactive
      // callback timeout, and avoid flooding the database with all rows at once.
      const writeChunkSize = 20;
      for (
        let start = 0;
        start < preparedRows.length;
        start += writeChunkSize
      ) {
        const chunk = preparedRows.slice(start, start + writeChunkSize);
        const scannedAt = new Date();
        const operations = [];

        for (const row of chunk) {
          operations.push(
            prisma.productCatalogImportCandidate.upsert({
              where: {
                integrationId_remoteProductId: {
                  integrationId,
                  remoteProductId: row.remoteProductId,
                },
              },
              create: {
                integrationId,
                remoteProductId: row.remoteProductId,
                sku: row.sku,
                payloadJson: JSON.stringify(row.item),
                status: row.matchedProductId ? "MATCHED" : "PENDING",
                matchedProductId: row.matchedProductId,
              },
              update: {
                sku: row.sku,
                payloadJson: JSON.stringify(row.item),
                status: row.matchedProductId ? "MATCHED" : "PENDING",
                matchedProductId: row.matchedProductId,
              },
            })
          );

          if (row.matchedProductId) {
            operations.push(
              prisma.productWebsiteListing.upsert({
                where: {
                  productId_integrationId: {
                    productId: row.matchedProductId,
                    integrationId,
                  },
                },
                create: {
                  productId: row.matchedProductId,
                  integrationId,
                  remoteProductId: row.remoteProductId,
                  syncStatus: "SYNCED",
                  lastSyncedAt: scannedAt,
                },
                update: {
                  remoteProductId: row.remoteProductId,
                },
              })
            );
          }
        }

        if (operations.length) {
          await prisma.$transaction(operations);
        }
      }

      pages += 1;
      cursor = String(body.nextCursor || "");
      if (!cursor) break;
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastCatalogSyncAt: new Date() },
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message:
        "Catalog scan complete. Received " +
        received +
        ", matched by SKU " +
        matched +
        ", review needed " +
        pending +
        ".",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}


export async function scanAllIntegrationCatalogs(): Promise<ActionState> {
  try {
    await requireAdmin();

    const integrations = await prisma.integration.findMany({
      where: {
        status: true,
        platform: "LARAVEL",
        baseUrl: { not: null },
        catalogApiToken: { not: null },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    if (!integrations.length) {
      return {
        success: false,
        message: "No active Laravel catalog integrations are configured.",
      };
    }

    let completed = 0;
    const failures: string[] = [];

    for (const integration of integrations) {
      const result = await importIntegrationCatalog(integration.id);
      if (result.success) {
        completed += 1;
      } else {
        failures.push(integration.name + ": " + result.message);
      }
    }

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");

    return {
      success: failures.length === 0,
      message:
        "Catalog scan finished for " +
        completed +
        " of " +
        integrations.length +
        " website(s)." +
        (failures.length
          ? " Failed: " + failures.join(" | ").slice(0, 900)
          : ""),
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}


export async function createOmsProductFromCatalogCandidate(
  candidateId: string
): Promise<ActionState & { productId?: string }> {
  try {
    await requireAdmin();

    const candidate = await prisma.productCatalogImportCandidate.findUnique({
      where: { id: candidateId },
      include: { integration: true },
    });

    if (!candidate) {
      return { success: false, message: "Website product candidate not found." };
    }

    const sku = String(candidate.sku || "").trim();
    if (!sku) {
      return { success: false, message: "Website product has no SKU." };
    }

    const normalizedKey = normalizedSkuKey(sku);

    const allCandidates = await prisma.productCatalogImportCandidate.findMany({
      include: {
        integration: {
          select: { id: true, name: true },
        },
      },
    });

    const equivalentCandidates = allCandidates.filter(
      (row) => normalizedSkuKey(row.sku) === normalizedKey
    );

    if (!equivalentCandidates.length) {
      return {
        success: false,
        message: "No scanned website records were found for this SKU.",
      };
    }

    const integrationCounts = new Map<string, number>();
    for (const row of equivalentCandidates) {
      integrationCounts.set(
        row.integrationId,
        (integrationCounts.get(row.integrationId) || 0) + 1
      );
    }

    const ambiguousWebsites = equivalentCandidates
      .filter((row) => (integrationCounts.get(row.integrationId) || 0) > 1)
      .map((row) => row.integration.name)
      .filter((value, index, list) => list.indexOf(value) === index);

    if (ambiguousWebsites.length) {
      return {
        success: false,
        message:
          "Creation is blocked because the same normalized SKU appears more than once on: " +
          ambiguousWebsites.join(", ") +
          ". Fix that website SKU duplication first.",
      };
    }

    const sourcePayload = JSON.parse(
      candidate.payloadJson
    ) as Record<string, unknown>;
    const sourceName = productNameFromWebsite(sourcePayload, sku);
    const sourceSellingPrice = nonNegativeMoney(sourcePayload.sellingPrice);
    const sourceOldPrice = nonNegativeMoney(sourcePayload.oldPrice);

    const possibleExisting = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        sellingPrice: true,
        catalogContent: {
          select: { oldPrice: true },
        },
      },
    });

    const normalizedMatches = possibleExisting.filter(
      (product) => normalizedSkuKey(product.sku) === normalizedKey
    );

    if (normalizedMatches.length > 1) {
      return {
        success: false,
        message:
          "Multiple OMS products normalize to the same SKU. Creation is blocked so stock/purchase data cannot be merged accidentally. Reconcile these OMS SKUs first: " +
          normalizedMatches.map((row) => row.sku).join(" | "),
      };
    }

    const productId = await prisma.$transaction(async (tx) => {
      let productId: string;
      let masterSellingPrice: number;
      let masterOldPrice: number;

      if (normalizedMatches.length === 1) {
        const existing = normalizedMatches[0];
        productId = existing.id;
        masterSellingPrice = Number(existing.sellingPrice || 0);
        masterOldPrice = Number(existing.catalogContent?.oldPrice || 0);
      } else {
        // Website catalog import NEVER establishes OMS physical inventory.
        // Only catalog/content values come from the selected website.
        const parent = await tx.productParent.create({
          data: {
            sku,
            name: sourceName,
            stockMode: "VARIANT_STOCK",
            stockQuantity: 0,
            stockVerifiedAt: null,
            purchasePrice: null,
            status: true,
          },
        });

        const product = await tx.product.create({
          data: {
            parentId: parent.id,
            sku,
            slug: productInternalSlug(sku),
            name: sourceName,
            quantity: 0,
            unitsPerSale: 1,
            stockVerifiedAt: null,
            purchasePrice: 0,
            sellingPrice: sourceSellingPrice,
            status: sourcePayload.active !== false,
          },
        });

        await tx.productCatalogContent.create({
          data: {
            productId: product.id,
            banglaName: optionalText(sourcePayload.banglaName),
            englishName: optionalText(sourcePayload.englishName),
            productSlug: optionalText(sourcePayload.productSlug),
            shortDescriptionHtml: optionalText(
              sourcePayload.shortDescriptionHtml
            ),
            fullDescriptionHtml: optionalText(
              sourcePayload.fullDescriptionHtml
            ),
            oldPrice: sourceOldPrice > 0 ? sourceOldPrice : null,
            featured: Boolean(sourcePayload.featured),
            sortOrder: Number.isSafeInteger(Number(sourcePayload.sortOrder))
              ? Number(sourcePayload.sortOrder)
              : 0,
            metaTitle: optionalText(sourcePayload.metaTitle),
            metaDescription: optionalText(sourcePayload.metaDescription),
            externalVideoUrl: optionalText(sourcePayload.externalVideoUrl),
          },
        });

        productId = product.id;
        masterSellingPrice = sourceSellingPrice;
        masterOldPrice = sourceOldPrice;
      }

      for (const websiteCandidate of equivalentCandidates) {
        const payload = JSON.parse(
          websiteCandidate.payloadJson
        ) as Record<string, unknown>;
        const websiteSellingPrice = nonNegativeMoney(payload.sellingPrice);
        const websiteOldPrice = nonNegativeMoney(payload.oldPrice);

        await tx.productWebsiteListing.upsert({
          where: {
            productId_integrationId: {
              productId,
              integrationId: websiteCandidate.integrationId,
            },
          },
          create: {
            productId,
            integrationId: websiteCandidate.integrationId,
            remoteProductId: websiteCandidate.remoteProductId,
            productSlugOverride: optionalText(payload.productSlug),
            sellingPriceOverride:
              websiteSellingPrice !== masterSellingPrice
                ? websiteSellingPrice
                : null,
            oldPriceOverride:
              websiteOldPrice !== masterOldPrice ? websiteOldPrice : null,
            active: payload.active !== false,
            featuredOverride:
              typeof payload.featured === "boolean"
                ? Boolean(payload.featured)
                : null,
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
          },
          update: {
            remoteProductId: websiteCandidate.remoteProductId,
            productSlugOverride: optionalText(payload.productSlug),
            sellingPriceOverride:
              websiteSellingPrice !== masterSellingPrice
                ? websiteSellingPrice
                : null,
            oldPriceOverride:
              websiteOldPrice !== masterOldPrice ? websiteOldPrice : null,
            active: payload.active !== false,
            featuredOverride:
              typeof payload.featured === "boolean"
                ? Boolean(payload.featured)
                : null,
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
          },
        });
      }

      await tx.productCatalogImportCandidate.updateMany({
        where: {
          id: { in: equivalentCandidates.map((row) => row.id) },
        },
        data: {
          matchedProductId: productId,
          status: "MATCHED",
        },
      });

      return productId;
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      productId,
      message:
        (normalizedMatches.length
          ? "Existing OMS Product matched"
          : "OMS Product created") +
        " using " +
        candidate.integration.name +
        " as the master-content source. Connected " +
        equivalentCandidates.length +
        " website listing(s). Website stock quantity and purchase cost were NOT imported.",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}


export async function searchOmsProductsForCatalogLink(
  query: string
): Promise<
  ActionState & {
    products?: Array<{
      id: string;
      sku: string;
      name: string;
      parentSku: string;
      sellingPrice: number;
    }>;
  }
> {
  try {
    await requireAdmin();

    const search = String(query || "").trim();
    if (search.length < 2) {
      return {
        success: true,
        message: "Type at least 2 characters.",
        products: [],
      };
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { contains: search } },
          { name: { contains: search } },
          { parent: { sku: { contains: search } } },
          { parent: { name: { contains: search } } },
        ],
      },
      select: {
        id: true,
        sku: true,
        name: true,
        sellingPrice: true,
        parent: {
          select: { sku: true },
        },
      },
      orderBy: [{ sku: "asc" }],
      take: 20,
    });

    return {
      success: true,
      message:
        products.length > 0
          ? products.length + " OMS product(s) found."
          : "No OMS product found.",
      products: products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        parentSku: product.parent.sku,
        sellingPrice: Number(product.sellingPrice || 0),
      })),
    };
  } catch (error) {
    return { success: false, message: safeMessage(error), products: [] };
  }
}

export async function connectCatalogCandidateToOmsProduct(
  candidateId: string,
  productId: string
): Promise<ActionState> {
  try {
    await requireAdmin();

    const [candidate, product] = await Promise.all([
      prisma.productCatalogImportCandidate.findUnique({
        where: { id: candidateId },
        include: {
          integration: true,
        },
      }),
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          parent: true,
          catalogContent: true,
        },
      }),
    ]);

    if (!candidate) {
      return { success: false, message: "Website product candidate not found." };
    }
    if (!product) {
      return { success: false, message: "OMS product not found." };
    }

    const sourceKey = normalizedSkuKey(candidate.sku);
    const sourcePayload = JSON.parse(
      candidate.payloadJson
    ) as Record<string, unknown>;

    const allCandidates = await prisma.productCatalogImportCandidate.findMany({
      include: {
        integration: {
          select: { id: true, name: true, baseUrl: true },
        },
      },
    });

    const equivalentCandidates = allCandidates.filter(
      (row) => normalizedSkuKey(row.sku) === sourceKey
    );

    const integrationCounts = new Map<string, number>();
    for (const row of equivalentCandidates) {
      integrationCounts.set(
        row.integrationId,
        (integrationCounts.get(row.integrationId) || 0) + 1
      );
    }

    const ambiguousWebsites = equivalentCandidates
      .filter((row) => (integrationCounts.get(row.integrationId) || 0) > 1)
      .map((row) => row.integration.name)
      .filter((value, index, list) => list.indexOf(value) === index);

    if (ambiguousWebsites.length) {
      return {
        success: false,
        message:
          "Manual connection is blocked because this website SKU appears more than once on: " +
          ambiguousWebsites.join(", ") +
          ". Fix the duplicate remote SKU first.",
      };
    }

    // IMPORTANT: manual linking uses the exact selected OMS Product row.
    // No ProductParent or Product is created, and inventory/buying/selling
    // fields on the selected OMS variation are never updated here.
    const baseUrl = candidate.integration.baseUrl || "";
    const shortDescriptionHtml = absolutizeHtmlMediaUrls(
      sourcePayload.shortDescriptionHtml,
      baseUrl
    );
    const fullDescriptionHtml = absolutizeHtmlMediaUrls(
      sourcePayload.fullDescriptionHtml,
      baseUrl
    );

    await prisma.$transaction(async (tx) => {
      await tx.productCatalogContent.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          banglaName: optionalText(sourcePayload.banglaName),
          englishName: optionalText(sourcePayload.englishName),
          productSlug: optionalText(sourcePayload.productSlug),
          shortDescriptionHtml: optionalText(shortDescriptionHtml),
          fullDescriptionHtml: optionalText(fullDescriptionHtml),
          oldPrice:
            product.catalogContent?.oldPrice ??
            (nonNegativeMoney(sourcePayload.oldPrice) > 0
              ? nonNegativeMoney(sourcePayload.oldPrice)
              : null),
          featured: Boolean(sourcePayload.featured),
          sortOrder: Number.isSafeInteger(Number(sourcePayload.sortOrder))
            ? Number(sourcePayload.sortOrder)
            : 0,
          metaTitle: optionalText(sourcePayload.metaTitle),
          metaDescription: optionalText(sourcePayload.metaDescription),
          externalVideoUrl: optionalText(sourcePayload.externalVideoUrl),
        },
        update: {
          banglaName: optionalText(sourcePayload.banglaName),
          englishName: optionalText(sourcePayload.englishName),
          productSlug: optionalText(sourcePayload.productSlug),
          shortDescriptionHtml: optionalText(shortDescriptionHtml),
          fullDescriptionHtml: optionalText(fullDescriptionHtml),
          // Preserve an OMS-maintained old price if it already exists.
          oldPrice:
            product.catalogContent?.oldPrice ??
            (nonNegativeMoney(sourcePayload.oldPrice) > 0
              ? nonNegativeMoney(sourcePayload.oldPrice)
              : null),
          featured: Boolean(sourcePayload.featured),
          sortOrder: Number.isSafeInteger(Number(sourcePayload.sortOrder))
            ? Number(sourcePayload.sortOrder)
            : 0,
          metaTitle: optionalText(sourcePayload.metaTitle),
          metaDescription: optionalText(sourcePayload.metaDescription),
          externalVideoUrl: optionalText(sourcePayload.externalVideoUrl),
        },
      });

      for (const websiteCandidate of equivalentCandidates) {
        const payload = JSON.parse(
          websiteCandidate.payloadJson
        ) as Record<string, unknown>;

        // Manual connect intentionally inherits the selected OMS Product's
        // selling price. Website prices do not override OMS pricing.
        const listing = await tx.productWebsiteListing.upsert({
          where: {
            productId_integrationId: {
              productId: product.id,
              integrationId: websiteCandidate.integrationId,
            },
          },
          create: {
            productId: product.id,
            integrationId: websiteCandidate.integrationId,
            remoteProductId: websiteCandidate.remoteProductId,
            productSlugOverride: optionalText(payload.productSlug),
            sellingPriceOverride: null,
            oldPriceOverride: null,
            active: payload.active !== false,
            featuredOverride:
              typeof payload.featured === "boolean"
                ? Boolean(payload.featured)
                : null,
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
          },
          update: {
            remoteProductId: websiteCandidate.remoteProductId,
            productSlugOverride: optionalText(payload.productSlug),
            sellingPriceOverride: null,
            oldPriceOverride: null,
            active: payload.active !== false,
            featuredOverride:
              typeof payload.featured === "boolean"
                ? Boolean(payload.featured)
                : null,
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
            lastSyncError: null,
          },
        });

        const taxonomy = remoteTaxonomyRows(payload);
        const termIds: string[] = [];

        for (const rawTerm of taxonomy) {
          const externalId = String(rawTerm.externalId || "").trim();
          const type = String(rawTerm.type || "").toUpperCase();
          if (
            !externalId ||
            !["CATEGORY", "SUBCATEGORY", "COLLECTION"].includes(type)
          ) {
            continue;
          }

          const term = await tx.productWebsiteTaxonomyTerm.upsert({
            where: {
              integrationId_type_externalId: {
                integrationId: websiteCandidate.integrationId,
                type: type as "CATEGORY" | "SUBCATEGORY" | "COLLECTION",
                externalId,
              },
            },
            create: {
              integrationId: websiteCandidate.integrationId,
              externalId,
              type: type as "CATEGORY" | "SUBCATEGORY" | "COLLECTION",
              parentExternalId: optionalText(rawTerm.parentExternalId),
              name:
                optionalText(rawTerm.name) ||
                optionalText(rawTerm.slug) ||
                externalId,
              slug: optionalText(rawTerm.slug) || externalId,
              active: true,
            },
            update: {
              parentExternalId: optionalText(rawTerm.parentExternalId),
              name:
                optionalText(rawTerm.name) ||
                optionalText(rawTerm.slug) ||
                externalId,
              slug: optionalText(rawTerm.slug) || externalId,
              active: true,
            },
          });

          termIds.push(term.id);
        }

        await tx.productWebsiteTaxonomy.deleteMany({
          where: { listingId: listing.id },
        });

        if (termIds.length) {
          await tx.productWebsiteTaxonomy.createMany({
            data: termIds.map((termId) => ({
              listingId: listing.id,
              termId,
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.productCatalogImportCandidate.updateMany({
        where: {
          id: { in: equivalentCandidates.map((row) => row.id) },
        },
        data: {
          matchedProductId: product.id,
          status: "MATCHED",
        },
      });
    });

    const mediaResult = await importRemoteMediaForExistingProduct({
      productId: product.id,
      payload: sourcePayload,
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message:
        "Connected website SKU " +
        candidate.sku +
        " to existing OMS variation " +
        product.sku +
        ". Preserved OMS stock, purchase price and selling price. Connected " +
        equivalentCandidates.length +
        " website listing(s), restored website taxonomy, imported " +
        mediaResult.importedImages +
        " image(s) and " +
        mediaResult.importedVideos +
        " video(s) where OMS media was empty.",
    };
  } catch (error) {
    return { success: false, message: safeMessage(error) };
  }
}
