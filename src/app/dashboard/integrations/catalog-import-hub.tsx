"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Layers3, RefreshCw, Search, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { scanAllIntegrationCatalogs } from "./actions";

export type CatalogImportHubRow = {
  sku: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  websiteCount: number;
  websiteNames: string[];
  remoteProductCount: number;
  hasConflict: boolean;
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
      if (result.success) window.location.reload();
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "ALL", label: "All" },
    { key: "MATCHED", label: "Matched" },
    { key: "MISSING", label: "Missing OMS" },
    { key: "MULTI", label: "Multiple Websites" },
    { key: "CONFLICT", label: "Content Conflict" },
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
            onClick={() => setExpanded((value) => !value)}
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
                          <Badge label="CONFLICT" className="bg-rose-50 text-rose-700" />
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
                        <span className="text-xs text-slate-400">Review creation next</span>
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
