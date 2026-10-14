"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Layers3, RefreshCw, Search, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  connectCatalogCandidateToOmsProduct,
  createOmsProductFromCatalogCandidate,
  scanAllIntegrationCatalogs,
  searchOmsProductsForCatalogLink,
} from "./actions";

export type CatalogImportHubRow = {
  sku: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  websiteCount: number;
  websiteNames: string[];
  remoteProductCount: number;
  hasConflict: boolean;
  representativeCandidateId: string;
  sourceOptions: Array<{
    candidateId: string;
    websiteName: string;
    productName: string;
    sellingPrice: number;
  }>;
};

type Props = {
  summary: {
    websiteCount: number;
    remoteProductCount: number;
    uniqueSkuCount: number;
    matchedSkuCount: number;
    missingSkuCount: number;
    multiWebsiteSkuCount: number;
    conflictSkuCount: number;
  };
  rows: CatalogImportHubRow[];
};

type Filter = "ALL" | "MATCHED" | "MISSING" | "MULTI" | "CONFLICT";

export default function CatalogImportHub({ summary, rows }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("catalog-import-hub-open") === "1") {
        setExpanded(true);
      }
    } catch {
      // Ignore storage access failures.
    }
  }, []);

  function setHubExpanded(next: boolean) {
    setExpanded(next);
    try {
      window.sessionStorage.setItem(
        "catalog-import-hub-open",
        next ? "1" : "0"
      );
    } catch {
      // Ignore storage access failures.
    }
  }

  function keepHubOpenAfterReload() {
    try {
      window.sessionStorage.setItem("catalog-import-hub-open", "1");
    } catch {
      // Ignore storage access failures.
    }
  }
  const [sourceBySku, setSourceBySku] = useState<Record<string, string>>({});
  const [manualLinkSku, setManualLinkSku] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<
    Array<{
      id: string;
      sku: string;
      name: string;
      parentSku: string;
      sellingPrice: number;
    }>
  >([]);
  const [selectedOmsProductId, setSelectedOmsProductId] = useState("");
  const [searchingOms, setSearchingOms] = useState(false);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter === "MATCHED" && !row.matchedProductId) return false;
      if (filter === "MISSING" && row.matchedProductId) return false;
      if (filter === "MULTI" && row.websiteCount < 2) return false;
      if (filter === "CONFLICT" && !row.hasConflict) return false;

      if (!q) return true;

      return (
        row.sku.toLowerCase().includes(q) ||
        (row.matchedProductName || "").toLowerCase().includes(q) ||
        row.websiteNames.some((name) => name.toLowerCase().includes(q))
      );
    });
  }, [filter, rows, search]);

  function scanAll() {
    setMessage("");
    startTransition(async () => {
      const result = await scanAllIntegrationCatalogs();
      setMessage(result.message);
      if (result.success) {
        keepHubOpenAfterReload();
        window.location.reload();
      }
    });
  }

  function createOmsProduct(row: CatalogImportHubRow) {
    const candidateId =
      sourceBySku[row.sku] ||
      row.sourceOptions[0]?.candidateId ||
      "";

    if (!candidateId) {
      setMessage("Choose which website should provide the initial OMS master content.");
      return;
    }

    const source = row.sourceOptions.find(
      (option) => option.candidateId === candidateId
    );

    if (
      !window.confirm(
        "Create one OMS Master for " +
          row.sku +
          " using " +
          (source?.websiteName || "the selected website") +
          " as the initial content source?\n\nAll websites carrying this SKU will be connected to the same OMS product. Website stock quantity and purchase cost will NOT be imported."
      )
    ) {
      return;
    }

    setMessage("");
    startTransition(async () => {
      const result = await createOmsProductFromCatalogCandidate(candidateId);
      setMessage(result.message);
      if (result.success) {
        keepHubOpenAfterReload();
        window.location.reload();
      }
    });
  }

  async function searchOmsProducts() {
    const query = manualSearch.trim();
    if (query.length < 2) {
      setMessage("Type at least 2 characters to search OMS SKU or product name.");
      return;
    }

    setSearchingOms(true);
    setMessage("");
    try {
      const result = await searchOmsProductsForCatalogLink(query);
      setManualResults(result.products || []);
      setMessage(result.message);
    } finally {
      setSearchingOms(false);
    }
  }

  function openManualLink(row: CatalogImportHubRow) {
    setManualLinkSku(row.sku);
    setManualSearch("");
    setManualResults([]);
    setSelectedOmsProductId("");
    setMessage("");
  }

  function connectToOmsProduct(row: CatalogImportHubRow) {
    if (!selectedOmsProductId) {
      setMessage("Select an OMS SKU first.");
      return;
    }

    const sourceCandidateId =
      sourceBySku[row.sku] ||
      row.sourceOptions[0]?.candidateId ||
      "";

    if (!sourceCandidateId) {
      setMessage(
        "Choose the master content source website first. Its content, media and taxonomy will be imported into the selected existing OMS variation."
      );
      return;
    }

    const selected = manualResults.find(
      (product) => product.id === selectedOmsProductId
    );
    const source = row.sourceOptions.find(
      (option) => option.candidateId === sourceCandidateId
    );

    if (
      !window.confirm(
        "Connect website SKU " +
          row.sku +
          " to existing OMS SKU " +
          (selected?.sku || "") +
          " using " +
          (source?.websiteName || "the selected website") +
          " as the content/media source?\n\nThe exact existing OMS variation will be reused. OMS stock, purchase price, selling price and inventory setup will NOT be changed."
      )
    ) {
      return;
    }

    setMessage("");
    startTransition(async () => {
      const result = await connectCatalogCandidateToOmsProduct(
        sourceCandidateId,
        selectedOmsProductId
      );
      setMessage(result.message);
      if (result.success) {
        keepHubOpenAfterReload();
        window.location.reload();
      }
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "ALL", label: "All" },
    { key: "MATCHED", label: "Matched" },
    { key: "MISSING", label: "Missing OMS" },
    { key: "MULTI", label: "Multiple Websites" },
    { key: "CONFLICT", label: "Content Difference" },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Layers3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">Catalog Import Hub</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Review website products only when needed. Kept collapsed so integrations stay easy to reach.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                {summary.remoteProductCount} remote
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {summary.matchedSkuCount} matched
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                {summary.missingSkuCount} missing
              </span>
              {summary.conflictSkuCount > 0 ? (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                  {summary.conflictSkuCount} conflicts
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={scanAll}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (pending ? "animate-spin" : "")} />
            {pending ? "Scanning..." : "Scan All Websites"}
          </Button>
          <Button
            type="button"
            onClick={() => setHubExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="mr-2 h-4 w-4" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            {expanded ? "Close Hub" : "Open Catalog Hub"}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="mx-5 mb-4 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:mx-6">
          {message}
        </div>
      ) : null}

      {expanded ? (
        <>
          <div className="grid gap-3 border-t p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 sm:p-6">
            <Stat label="Websites" value={summary.websiteCount} />
            <Stat label="Remote Products" value={summary.remoteProductCount} />
            <Stat label="Unique SKUs" value={summary.uniqueSkuCount} />
            <Stat label="Matched OMS" value={summary.matchedSkuCount} tone="green" />
            <Stat label="Missing OMS" value={summary.missingSkuCount} tone="amber" />
            <Stat label="Multi-store" value={summary.multiWebsiteSkuCount} tone="blue" />
            <Stat label="Conflicts" value={summary.conflictSkuCount} tone="rose" />
          </div>

          <div className="border-t px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                    (filter === item.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  {item.label}
                </button>
              ))}

              <label className="ml-auto flex min-w-[240px] items-center gap-2 rounded-xl border bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search SKU, product or website"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto border-t">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">OMS Match</th>
                  <th className="px-5 py-3">Websites</th>
                  <th className="px-5 py-3">Remote Records</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.map((row) => (
                  <tr key={row.sku} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-950">{row.sku}</p>
                    </td>
                    <td className="px-5 py-3">
                      {row.matchedProductId ? (
                        <div>
                          <p className="font-medium text-emerald-700">Matched</p>
                          <p className="mt-0.5 max-w-[250px] truncate text-xs text-slate-500">
                            {row.matchedProductName || "OMS product"}
                          </p>
                        </div>
                      ) : (
                        <span className="font-medium text-amber-700">Missing in OMS</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.websiteNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            <Store className="h-3 w-3" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.remoteProductCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.websiteCount > 1 ? (
                          <Badge label="MULTI-STORE" className="bg-blue-50 text-blue-700" />
                        ) : null}
                        {row.hasConflict ? (
                          <Badge label="CONTENT DIFF" className="bg-rose-50 text-rose-700" />
                        ) : row.matchedProductId ? (
                          <Badge label="READY TO REVIEW" className="bg-emerald-50 text-emerald-700" />
                        ) : (
                          <Badge label="CREATE / MATCH" className="bg-amber-50 text-amber-700" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {row.matchedProductId ? (
                        <Link
                          href={"/dashboard/products?edit=" + encodeURIComponent(row.matchedProductId) + "&section=catalog"}
                          className="inline-flex rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Review Product
                        </Link>
                      ) : (
                        <div className="ml-auto flex w-[260px] flex-col gap-2">
                          {row.sourceOptions.length > 1 ? (
                            <select
                              value={
                                sourceBySku[row.sku] ||
                                row.sourceOptions[0]?.candidateId ||
                                ""
                              }
                              onChange={(event) =>
                                setSourceBySku((current) => ({
                                  ...current,
                                  [row.sku]: event.target.value,
                                }))
                              }
                              disabled={pending}
                              className="w-full rounded-lg border bg-white px-2.5 py-2 text-xs text-slate-700 outline-none"
                              aria-label={"Choose master content source for " + row.sku}
                            >
                              <option value="">No website source available</option>
                              {row.sourceOptions.map((option) => (
                                <option
                                  key={option.candidateId}
                                  value={option.candidateId}
                                >
                                  {option.websiteName}
                                  {option.sellingPrice > 0
                                    ? " · Tk " + option.sellingPrice.toLocaleString("en-BD")
                                    : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-left text-xs text-slate-600">
                              Source: {row.sourceOptions[0]?.websiteName || row.websiteNames[0]}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={pending || row.sourceOptions.length === 0}
                            onClick={() => createOmsProduct(row)}
                            className="inline-flex justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {row.websiteCount > 1
                              ? "Review & Create OMS Master"
                              : "Create OMS Product"}
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => openManualLink(row)}
                            className="inline-flex justify-center rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Connect to Existing OMS SKU
                          </button>

                          {manualLinkSku === row.sku ? (
                            <div className="rounded-xl border bg-slate-50 p-3 text-left">
                              <p className="text-xs font-semibold text-slate-800">
                                Search existing OMS product
                              </p>
                              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                                Search by SKU, product name, parent SKU or parent name.
                              </p>

                              <div className="mt-2 flex gap-2">
                                <input
                                  value={manualSearch}
                                  onChange={(event) =>
                                    setManualSearch(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void searchOmsProducts();
                                    }
                                  }}
                                  placeholder="Search OMS SKU..."
                                  className="min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-2 text-xs outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={searchingOms}
                                  onClick={() => void searchOmsProducts()}
                                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  {searchingOms ? "Searching..." : "Search"}
                                </button>
                              </div>

                              {row.sourceOptions.length > 1 ? (
                                <div className="mt-3">
                                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Master content source
                                  </label>
                                  <select
                                    value={
                                      sourceBySku[row.sku] ||
                                      row.sourceOptions[0]?.candidateId ||
                                      ""
                                    }
                                    onChange={(event) =>
                                      setSourceBySku((current) => ({
                                        ...current,
                                        [row.sku]: event.target.value,
                                      }))
                                    }
                                    disabled={pending}
                                    className="w-full rounded-lg border bg-white px-2.5 py-2 text-xs text-slate-700 outline-none"
                                  >
                                    <option value="">No website source available</option>
                                    {row.sourceOptions.map((option) => (
                                      <option
                                        key={option.candidateId}
                                        value={option.candidateId}
                                      >
                                        {option.websiteName}
                                        {option.sellingPrice > 0
                                          ? " · Tk " +
                                            option.sellingPrice.toLocaleString("en-BD")
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                                    OMS automatically selects the first available website as the
                                    import source. You can change it here if needed. Content, media
                                    and collection come from this website; the selected OMS variation
                                    keeps its own stock, purchase price and selling price.
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-3 rounded-lg border bg-white px-2.5 py-2 text-[10px] text-slate-600">
                                  Content source:{" "}
                                  <strong>
                                    {row.sourceOptions[0]?.websiteName ||
                                      row.websiteNames[0]}
                                  </strong>
                                </div>
                              )}

                              {manualResults.length ? (
                                <div className="mt-2 max-h-52 space-y-1.5 overflow-auto">
                                  {manualResults.map((product) => (
                                    <label
                                      key={product.id}
                                      className={
                                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition " +
                                        (selectedOmsProductId === product.id
                                          ? "border-slate-900 bg-white"
                                          : "bg-white hover:border-slate-300")
                                      }
                                    >
                                      <input
                                        type="radio"
                                        name={"manual-oms-link-" + row.sku}
                                        value={product.id}
                                        checked={selectedOmsProductId === product.id}
                                        onChange={() =>
                                          setSelectedOmsProductId(product.id)
                                        }
                                        className="mt-0.5"
                                      />
                                      <span className="min-w-0">
                                        <span className="block break-words text-xs font-semibold text-slate-900">
                                          {product.sku}
                                        </span>
                                        <span className="mt-0.5 block break-words text-[10px] text-slate-500">
                                          {product.name} · Parent {product.parentSku}
                                          {product.sellingPrice > 0
                                            ? " · Tk " +
                                              product.sellingPrice.toLocaleString(
                                                "en-BD"
                                              )
                                            : ""}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    pending ||
                                    !selectedOmsProductId ||
                                    row.sourceOptions.length === 0
                                  }
                                  onClick={() => connectToOmsProduct(row)}
                                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Connect Selected OMS SKU
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setManualLinkSku(null)}
                                  className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {row.websiteCount > 1 ? (
                            <p className="text-left text-[10px] leading-4 text-slate-400">
                              Creates 1 OMS product and connects all {row.websiteCount} websites.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                      No catalog records match this filter yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={"rounded-full px-2 py-1 text-[10px] font-bold tracking-wide " + className}>
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "amber" | "blue" | "rose";
}) {
  const tones = {
    slate: "bg-slate-50 text-slate-950",
    green: "bg-emerald-50 text-emerald-950",
    amber: "bg-amber-50 text-amber-950",
    blue: "bg-blue-50 text-blue-950",
    rose: "bg-rose-50 text-rose-950",
  };

  return (
    <div className={"rounded-2xl border p-3 " + tones[tone]}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
