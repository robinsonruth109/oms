"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  Globe2,
  Settings2,
} from "lucide-react";

import CatalogSettings from "./catalog-settings";
import {
  CopyTextButton,
  RegenerateApiKeyButton,
  SecretField,
  ToggleIntegrationButton,
} from "./integration-row-actions";

type IntegrationCardProps = {
  integration: {
    id: string;
    name: string;
    slug: string;
    platform: "SHOPIFY" | "LARAVEL";
    catalogMode: "COLLECTION" | "SUBCATEGORY";
    status: boolean;
    sourceName: string;
    baseUrl: string;
    hasCatalogApiToken: boolean;
    productSyncEnabled: boolean;
    lastTaxonomySyncAt: string | null;
    lastCatalogSyncAt: string | null;
    apiKey: string;
    webhookSecret: string | null;
  };
  endpoint: string;
  samplePayload: string;
  shortApiKey: string;
};

type Tab = "overview" | "catalog" | "security" | "payload";

export default function IntegrationCard({
  integration,
  endpoint,
  samplePayload,
  shortApiKey,
}: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: Array<{
    key: Tab;
    label: string;
    icon: typeof Globe2;
  }> = [
    { key: "overview", label: "Overview", icon: Globe2 },
    { key: "catalog", label: "Catalog", icon: Settings2 },
    { key: "security", label: "Security", icon: Settings2 },
    { key: "payload", label: "Payload", icon: Code2 },
  ];

  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-950">
              {integration.name}
            </h3>
            <StatusBadge active={integration.status} />
            <span
              className={
                "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide " +
                (integration.productSyncEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600")
              }
            >
              {integration.productSyncEnabled ? "SYNC ON" : "SYNC OFF"}
            </span>
          </div>

          <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
            <span className="truncate">
              <strong className="font-semibold text-slate-700">Source:</strong>{" "}
              {integration.sourceName}
            </span>
            <span>
              <strong className="font-semibold text-slate-700">Engine:</strong>{" "}
              {integration.platform}
            </span>
            <span>
              <strong className="font-semibold text-slate-700">Catalog:</strong>{" "}
              {integration.catalogMode === "COLLECTION" ? "Collections" : "Subcategories"}
            </span>
            <span className="truncate">
              <strong className="font-semibold text-slate-700">Slug:</strong>{" "}
              {integration.slug}
            </span>
          </div>

          {integration.baseUrl ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{integration.baseUrl}</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {expanded ? "Close" : "Manage"}
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <ToggleIntegrationButton
            integrationId={integration.id}
            nextStatus={!integration.status}
            label={integration.status ? "Deactivate" : "Activate"}
          />
        </div>
      </div>

      {expanded ? (
        <div className="border-t bg-slate-50/60">
          <div className="flex gap-1 overflow-x-auto border-b bg-white px-4 pt-3 sm:px-5">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={
                    "inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3 py-2.5 text-xs font-semibold transition " +
                    (active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5">
            {tab === "overview" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Integration Name" value={integration.name} />
                <Info label="Slug" value={integration.slug} />
                <Info label="Source" value={integration.sourceName} />
                <Info
                  label="Status"
                  value={integration.status ? "Active" : "Inactive"}
                />
                <Info label="Website Engine" value={integration.platform} />
                <Info
                  label="Catalog Structure"
                  value={
                    integration.catalogMode === "COLLECTION"
                      ? "Collections"
                      : "Subcategories"
                  }
                />
                <Info
                  label="Last Taxonomy Sync"
                  value={integration.lastTaxonomySyncAt || "Never"}
                />
                <Info
                  label="Last Catalog Scan"
                  value={integration.lastCatalogSyncAt || "Never"}
                />

                <div className="rounded-xl border bg-white p-3 md:col-span-2 xl:col-span-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Website Base URL
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-800">
                    {integration.baseUrl || "Not configured"}
                  </p>
                </div>
              </div>
            ) : null}

            {tab === "catalog" ? (
              <CatalogSettings
                integration={{
                  id: integration.id,
                  platform: integration.platform,
                  catalogMode: integration.catalogMode,
                  baseUrl: integration.baseUrl,
                  hasCatalogApiToken: integration.hasCatalogApiToken,
                  productSyncEnabled: integration.productSyncEnabled,
                  lastTaxonomySyncAt: integration.lastTaxonomySyncAt,
                  lastCatalogSyncAt: integration.lastCatalogSyncAt,
                }}
                embedded
              />
            ) : null}

            {tab === "security" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    API Credentials
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Used by this integration to authenticate OMS order requests.
                  </p>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      API Key · {shortApiKey}
                    </p>
                    <SecretField label="API Key" value={integration.apiKey} />
                  </div>

                  <div className="mt-4">
                    <RegenerateApiKeyButton integrationId={integration.id} />
                  </div>
                </section>

                <section className="rounded-2xl border bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    Endpoint & Webhook
                  </h4>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Orders Endpoint
                    </p>
                    <div className="break-all rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      {endpoint}
                    </div>
                    <div className="mt-2">
                      <CopyTextButton value={endpoint} label="Endpoint" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Webhook Secret
                    </p>
                    {integration.webhookSecret ? (
                      <SecretField
                        label="Webhook Secret"
                        value={integration.webhookSecret}
                      />
                    ) : (
                      <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        No webhook secret set
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {tab === "payload" ? (
              <section className="rounded-2xl border bg-white">
                <details>
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
                    Show Sample JSON Payload
                  </summary>
                  <div className="border-t p-4">
                    <pre className="max-h-[480px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                      {samplePayload}
                    </pre>
                  </div>
                </details>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide " +
        (active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700")
      }
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
