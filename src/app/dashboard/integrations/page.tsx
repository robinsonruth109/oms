import { Layers3, Plus, Radio, Store } from "lucide-react";

import CreateIntegrationForm from "./create-integration-form";
import CatalogImportHub, {
  type CatalogImportHubRow,
} from "./catalog-import-hub";
import IntegrationCard from "./integration-card";

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
      orderBy: { name: "asc" },
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
    multiWebsiteSkuCount: catalogHubRows.filter((row) => row.websiteCount > 1)
      .length,
    conflictSkuCount: catalogHubRows.filter((row) => row.hasConflict).length,
  };

  const activeIntegrations = integrations.filter((item) => item.status).length;
  const syncEnabled = integrations.filter(
    (item) => item.productSyncEnabled
  ).length;
  const catalogConnected = integrations.filter(
    (item) => item.baseUrl && item.catalogApiToken
  ).length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Website Connections
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Integrations
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage website connections, catalog imports and publishing from one
              place without exposing technical settings until you need them.
            </p>
          </div>

          <a
            href="#new-integration"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create Integration
          </a>
        </div>

        <div className="grid border-t sm:grid-cols-3">
          <HeaderStat
            icon={Store}
            label="Active Websites"
            value={activeIntegrations}
            detail={`${integrations.length} total integrations`}
          />
          <HeaderStat
            icon={Radio}
            label="Product Sync On"
            value={syncEnabled}
            detail="automatic catalog publishing"
          />
          <HeaderStat
            icon={Layers3}
            label="Catalog Connected"
            value={catalogConnected}
            detail="base URL + catalog token ready"
          />
        </div>
      </section>

      <CatalogImportHub summary={catalogSummary} rows={catalogHubRows} />

      <section className="overflow-hidden rounded-3xl border bg-slate-50/50 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Website Integrations
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Compact overview first. Open Manage only when you need catalog,
              security or payload settings.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {integrations.length} integration{integrations.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          {integrations.map((integration) => {
            const endpoint = `/api/integrations/${integration.slug}/orders`;

            return (
              <IntegrationCard
                key={integration.id}
                integration={{
                  id: integration.id,
                  name: integration.name,
                  slug: integration.slug,
                  platform: integration.platform,
                  catalogMode: integration.catalogMode,
                  status: integration.status,
                  sourceName: integration.source.name,
                  baseUrl: integration.baseUrl || "",
                  hasCatalogApiToken: Boolean(integration.catalogApiToken),
                  productSyncEnabled: integration.productSyncEnabled,
                  lastTaxonomySyncAt: integration.lastTaxonomySyncAt
                    ? integration.lastTaxonomySyncAt.toISOString()
                    : null,
                  lastCatalogSyncAt: integration.lastCatalogSyncAt
                    ? integration.lastCatalogSyncAt.toISOString()
                    : null,
                  apiKey: integration.apiKey,
                  webhookSecret: integration.webhookSecret,
                }}
                endpoint={endpoint}
                samplePayload={samplePayload(integration.apiKey)}
                shortApiKey={maskApiKey(integration.apiKey)}
              />
            );
          })}

          {!integrations.length ? (
            <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-sm text-slate-500">
              No integrations found.
            </div>
          ) : null}
        </div>
      </section>

      <details
        id="new-integration"
        className="group overflow-hidden rounded-3xl border bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Create New Integration
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hidden by default so the main page stays focused on current websites.
            </p>
          </div>
          <span className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Open Form
          </span>
        </summary>

        <div className="border-t bg-slate-50/50 p-3 sm:p-4">
          <CreateIntegrationForm sources={sources} embedded />
        </div>
      </details>
    </div>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Store;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-slate-950">{value}</p>
          <p className="text-[11px] text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}
