"use server";

import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

      const skus = Array.from(
        new Set(items.map((item) => String(item.sku || "").trim()).filter(Boolean))
      );
      const products = skus.length
        ? await prisma.product.findMany({
            where: { sku: { in: skus } },
            select: { id: true, sku: true },
          })
        : [];
      const productBySku = new Map(
        products.map((product) => [product.sku, product.id])
      );

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const sku = String(item.sku || "").trim();
          const remoteProductId = String(item.externalProductId || "").trim();
          if (!sku || !remoteProductId) continue;

          const matchedProductId = productBySku.get(sku) || null;
          received += 1;
          if (matchedProductId) matched += 1;
          else pending += 1;

          await tx.productCatalogImportCandidate.upsert({
            where: {
              integrationId_remoteProductId: {
                integrationId,
                remoteProductId,
              },
            },
            create: {
              integrationId,
              remoteProductId,
              sku,
              payloadJson: JSON.stringify(item),
              status: matchedProductId ? "MATCHED" : "PENDING",
              matchedProductId,
            },
            update: {
              sku,
              payloadJson: JSON.stringify(item),
              status: matchedProductId ? "MATCHED" : "PENDING",
              matchedProductId,
            },
          });

          if (matchedProductId) {
            await tx.productWebsiteListing.upsert({
              where: {
                productId_integrationId: {
                  productId: matchedProductId,
                  integrationId,
                },
              },
              create: {
                productId: matchedProductId,
                integrationId,
                remoteProductId,
                syncStatus: "SYNCED",
                lastSyncedAt: new Date(),
              },
              update: {
                remoteProductId,
              },
            });
          }
        }

        await tx.integration.update({
          where: { id: integrationId },
          data: { lastCatalogSyncAt: new Date() },
        });
      });

      pages += 1;
      cursor = String(body.nextCursor || "");
      if (!cursor) break;
    }

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
