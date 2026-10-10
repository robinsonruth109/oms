"use client";

import { useState, useTransition } from "react";
import { RefreshCw, ScanSearch, TestTube2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  importIntegrationCatalog,
  syncIntegrationTaxonomy,
  testIntegrationCatalogConnection,
  updateIntegrationCatalogSettings,
} from "./actions";

type Props = {
  integration: {
    id: string;
    platform: "SHOPIFY" | "LARAVEL";
    catalogMode: "COLLECTION" | "SUBCATEGORY";
    baseUrl: string;
    hasCatalogApiToken: boolean;
    productSyncEnabled: boolean;
    lastTaxonomySyncAt: string | null;
    lastCatalogSyncAt: string | null;
  };
};

export default function CatalogSettings({ integration }: Props) {
  const [pending, startTransition] = useTransition();
  const [platform, setPlatform] = useState(integration.platform);
  const [catalogMode, setCatalogMode] = useState(integration.catalogMode);
  const [baseUrl, setBaseUrl] = useState(integration.baseUrl);
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(integration.productSyncEnabled);
  const [message, setMessage] = useState("");

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="mt-5 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Product Catalog Connection</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Website engine and catalog structure are separate. A Laravel site can use
            Shopify-style /collections URLs or /subcategory URLs.
          </p>
        </div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-xs font-semibold " +
            (integration.productSyncEnabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          {integration.productSyncEnabled ? "PRODUCT SYNC ON" : "PRODUCT SYNC OFF"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm text-slate-700">
          <span className="font-medium">Website Engine</span>
          <select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as "LARAVEL" | "SHOPIFY")
            }
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="LARAVEL">LARAVEL</option>
            <option value="SHOPIFY">SHOPIFY</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm text-slate-700">
          <span className="font-medium">Catalog Structure</span>
          <select
            value={catalogMode}
            onChange={(event) =>
              setCatalogMode(
                event.target.value as "COLLECTION" | "SUBCATEGORY"
              )
            }
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="SUBCATEGORY">Subcategory (/subcategory/slug)</option>
            <option value="COLLECTION">Collection (/collections/slug)</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">Website Base URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://shop.example.com"
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </label>

        <label className="space-y-1.5 text-sm text-slate-700 md:col-span-2 xl:col-span-3">
          <span className="font-medium">
            Laravel Catalog API Token
            {integration.hasCatalogApiToken ? (
              <span className="ml-2 text-xs font-normal text-emerald-600">
                Token saved
              </span>
            ) : null}
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={
              integration.hasCatalogApiToken
                ? "Leave blank to keep current token"
                : "Paste Laravel OMS catalog token"
            }
            autoComplete="new-password"
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 self-end rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable Product Sync
        </label>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateIntegrationCatalogSettings({
                integrationId: integration.id,
                platform,
                catalogMode,
                baseUrl,
                catalogApiToken: token || undefined,
                productSyncEnabled: enabled,
              })
            )
          }
        >
          Save Catalog Settings
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => testIntegrationCatalogConnection(integration.id))
          }
        >
          <TestTube2 className="mr-2 h-4 w-4" />
          Test Connection
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => syncIntegrationTaxonomy(integration.id))}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Categories / Collections
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => importIntegrationCatalog(integration.id))}
        >
          <ScanSearch className="mr-2 h-4 w-4" />
          Scan Existing Products by SKU
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
        <span>
          Taxonomy sync: {integration.lastTaxonomySyncAt || "Never"}
        </span>
        <span>
          Catalog scan: {integration.lastCatalogSyncAt || "Never"}
        </span>
      </div>
    </div>
  );
}
