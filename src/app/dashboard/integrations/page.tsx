import CreateIntegrationForm from "./create-integration-form";
import CatalogSettings from "./catalog-settings";
import CatalogImportHub, { type CatalogImportHubRow } from "./catalog-import-hub";
import {
  CopyTextButton,
  RegenerateApiKeyButton,
  SecretField,
  ToggleIntegrationButton,
} from "./integration-row-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function maskApiKey(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function samplePayload(apiKey: string) {
  return JSON.stringify(
    {
      apiKey,
      externalOrderId: "STORE-10001",
      invoiceId: "CW140900",
      customerName: "John Doe",
      phone: "01700000000",
      address: "Dhaka, Bangladesh",
      shippingPhone: "01700000000",
      shippingCustomerName: "John Doe",
      shippingAddress1: "House 10, Road 5",
      shippingAddress2: "",
      shippingCity: "Dhaka",
      shippingProvince: "Dhaka",
      shippingZip: "1207",
      shippingCountry: "Bangladesh",
      email: "customer@example.com",
      deliveryCharge: 120,
      discount: 0,
      advance: 0,
      totalAmount: 1220,
      note: "Leave at gate",
      items: [
        {
          sku: "CODE-ABC-01",
          name: "Demo Product",
          quantity: 2,
          price: 550,
        },
      ],
    },
    null,
    2
  );
}

export default async function IntegrationsPage() {
  const { prisma } = await import("@/lib/prisma");

  const [sources, integrations, catalogCandidates] = await Promise.all([
    prisma.orderSource.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.integration.findMany({
      include: {
        source: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.productCatalogImportCandidate.findMany({
      select: {
        sku: true,
        remoteProductId: true,
        payloadJson: true,
        matchedProductId: true,
        integrationId: true,
        integration: {
          select: {
            name: true,
          },
        },
        matchedProduct: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const contentSignature = (payloadJson: string) => {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return JSON.stringify({
        banglaName: payload.banglaName ?? null,
        englishName: payload.englishName ?? null,
        productSlug: payload.productSlug ?? null,
        sellingPrice: payload.sellingPrice ?? null,
        oldPrice: payload.oldPrice ?? null,
        shortDescriptionHtml: payload.shortDescriptionHtml ?? null,
        fullDescriptionHtml: payload.fullDescriptionHtml ?? null,
        metaTitle: payload.metaTitle ?? null,
        metaDescription: payload.metaDescription ?? null,
        externalVideoUrl: payload.externalVideoUrl ?? null,
        featured: payload.featured ?? null,
        active: payload.active ?? null,
        media: payload.media ?? null,
      });
    } catch {
      return payloadJson;
    }
  };

  const grouped = new Map<
    string,
    {
      sku: string;
      matchedProductId: string | null;
      matchedProductName: string | null;
      integrationIds: Set<string>;
      websiteNames: Set<string>;
      remoteProductIds: Set<string>;
      signatures: Set<string>;
    }
  >();

  for (const candidate of catalogCandidates) {
    const sku = candidate.sku.trim();
    if (!sku) continue;

    const current = grouped.get(sku) || {
      sku,
      matchedProductId: candidate.matchedProductId,
      matchedProductName: candidate.matchedProduct?.name || null,
      integrationIds: new Set<string>(),
      websiteNames: new Set<string>(),
      remoteProductIds: new Set<string>(),
      signatures: new Set<string>(),
    };

    if (!current.matchedProductId && candidate.matchedProductId) {
      current.matchedProductId = candidate.matchedProductId;
      current.matchedProductName = candidate.matchedProduct?.name || null;
    }

    current.integrationIds.add(candidate.integrationId);
    current.websiteNames.add(candidate.integration.name);
    current.remoteProductIds.add(
      candidate.integrationId + ":" + candidate.remoteProductId
    );
    current.signatures.add(contentSignature(candidate.payloadJson));

    grouped.set(sku, current);
  }

  const catalogHubRows: CatalogImportHubRow[] = Array.from(grouped.values())
    .map((row) => ({
      sku: row.sku,
      matchedProductId: row.matchedProductId,
      matchedProductName: row.matchedProductName,
      websiteCount: row.integrationIds.size,
      websiteNames: Array.from(row.websiteNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      remoteProductCount: row.remoteProductIds.size,
      hasConflict: row.integrationIds.size > 1 && row.signatures.size > 1,
    }))
    .sort((a, b) => {
      if (a.matchedProductId === null && b.matchedProductId !== null) return -1;
      if (a.matchedProductId !== null && b.matchedProductId === null) return 1;
      if (a.hasConflict !== b.hasConflict) return a.hasConflict ? -1 : 1;
      return a.sku.localeCompare(b.sku);
    });

  const catalogSummary = {
    websiteCount: integrations.filter(
      (integration) =>
        integration.status &&
        integration.platform === "LARAVEL" &&
        Boolean(integration.baseUrl) &&
        Boolean(integration.catalogApiToken)
    ).length,
    remoteProductCount: catalogCandidates.length,
    uniqueSkuCount: catalogHubRows.length,
    matchedSkuCount: catalogHubRows.filter((row) => row.matchedProductId).length,
    missingSkuCount: catalogHubRows.filter((row) => !row.matchedProductId).length,
    multiWebsiteSkuCount: catalogHubRows.filter((row) => row.websiteCount > 1).length,
    conflictSkuCount: catalogHubRows.filter((row) => row.hasConflict).length,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect every website to OMS for orders and catalog publishing. Website
          engine and Collection/Subcategory URL style are managed separately.
        </p>
      </section>

      <CreateIntegrationForm sources={sources} />

      <CatalogImportHub summary={catalogSummary} rows={catalogHubRows} />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Integration List
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Each integration gets its own endpoint:
            <span className="font-medium"> /api/integrations/[slug]/orders</span>
          </p>
        </div>

        <div className="space-y-4 p-4">
          {integrations.map((integration) => {
            const endpoint = `/api/integrations/${integration.slug}/orders`;

            return (
              <div
                key={integration.id}
                className="rounded-2xl border bg-slate-50 p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {integration.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        Slug: {integration.slug}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Website Engine
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.platform}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Source
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.source.name}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Catalog Structure
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.catalogMode === "COLLECTION"
                            ? "COLLECTIONS"
                            : "SUBCATEGORIES"}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.status ? "Active" : "Inactive"}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Short API Key View
                        </p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                          {maskApiKey(integration.apiKey)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Endpoint
                      </p>

                      <div className="break-all rounded-xl border bg-white px-3 py-2 text-sm text-slate-800">
                        {endpoint}
                      </div>

                      <CopyTextButton value={endpoint} label="Endpoint" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        API Key
                      </p>
                      <SecretField label="API Key" value={integration.apiKey} />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        Webhook Secret
                      </p>

                      {integration.webhookSecret ? (
                        <SecretField
                          label="Webhook Secret"
                          value={integration.webhookSecret}
                        />
                      ) : (
                        <div className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-500">
                          No webhook secret set
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <ToggleIntegrationButton
                        integrationId={integration.id}
                        nextStatus={!integration.status}
                        label={integration.status ? "Deactivate" : "Activate"}
                      />
                      <RegenerateApiKeyButton integrationId={integration.id} />
                    </div>
                  </div>
                </div>

                <CatalogSettings
                  integration={{
                    id: integration.id,
                    platform: integration.platform,
                    catalogMode: integration.catalogMode,
                    baseUrl: integration.baseUrl || "",
                    hasCatalogApiToken: Boolean(integration.catalogApiToken),
                    productSyncEnabled: integration.productSyncEnabled,
                    lastTaxonomySyncAt: integration.lastTaxonomySyncAt
                      ? integration.lastTaxonomySyncAt.toISOString()
                      : null,
                    lastCatalogSyncAt: integration.lastCatalogSyncAt
                      ? integration.lastCatalogSyncAt.toISOString()
                      : null,
                  }}
                />

                <div className="mt-5 rounded-2xl border bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Sample JSON Payload
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                    {samplePayload(integration.apiKey)}
                  </pre>
                </div>
              </div>
            );
          })}

          {!integrations.length && (
            <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              No integrations found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}