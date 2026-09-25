"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  connectMetaCampaignToExisting,
  disconnectMetaCampaignReportGroup,
  disconnectMetaConnection,
  saveMetaCampaignMappings,
  syncMetaAdsNow,
  toggleMetaAdAccount,
} from "./actions";

type Parent = { id: string; sku: string; name: string };
type Source = { id: string; name: string; type: string };

type Connection = {
  id: string;
  metaUserName: string | null;
  metaUserId: string;
  status: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  accounts: {
    id: string;
    metaAccountId: string;
    name: string;
    currency: string;
    timezoneName: string | null;
    enabled: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
  }[];
};

type Campaign = {
  id: string;
  metaCampaignId: string;
  campaignName: string;
  account: {
    id: string;
    metaAccountId: string;
    name: string;
    currency: string;
  };
  spend: number;
  mapping: {
    productParentId: string;
    productParent: { sku: string; name: string };
    sourceIds: string[];
    sources: { id: string; name: string }[];
    reportGroupId: string | null;
    linkedCampaigns: { id: string; campaignName: string }[];
  } | null;
};

type Draft = {
  productParentId: string;
  sourceIds: string[];
};

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function amount(value: number, currency: string) {
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return code + " " + Number(value || 0).toFixed(2);
  }
}


function normalizeParentSearch(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeParentSearchLoose(value: string) {
  return normalizeParentSearch(value).replace(/[^a-z0-9]/g, "");
}

function filterParents(parents: Parent[], rawQuery: string) {
  const q = normalizeParentSearch(rawQuery);
  const qLoose = normalizeParentSearchLoose(rawQuery);

  if (!q && !qLoose) {
    return parents.slice(0, 20);
  }

  const startsWithMatches: Parent[] = [];
  const containsMatches: Parent[] = [];

  for (const parent of parents) {
    const sku = normalizeParentSearch(parent.sku);
    const name = normalizeParentSearch(parent.name);
    const skuLoose = normalizeParentSearchLoose(parent.sku);
    const nameLoose = normalizeParentSearchLoose(parent.name);

    const starts =
      (q && (sku.startsWith(q) || name.startsWith(q))) ||
      (qLoose &&
        (skuLoose.startsWith(qLoose) || nameLoose.startsWith(qLoose)));

    const contains =
      (q && (sku.includes(q) || name.includes(q))) ||
      (qLoose &&
        (skuLoose.includes(qLoose) || nameLoose.includes(qLoose)));

    if (starts) {
      startsWithMatches.push(parent);
    } else if (contains) {
      containsMatches.push(parent);
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, 20);
}

function SearchableParentPicker({
  parents,
  value,
  onChange,
}: {
  parents: Parent[];
  value: string;
  onChange: (parentId: string) => void;
}) {
  const selectedParent = parents.find((parent) => parent.id === value) || null;
  const selectedLabel = selectedParent
    ? selectedParent.sku + " - " + selectedParent.name
    : "";

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  const filteredParents = useMemo(
    () => filterParents(parents, query === selectedLabel ? "" : query),
    [parents, query, selectedLabel]
  );

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);

    if (value && nextQuery !== selectedLabel) {
      onChange("");
    }
  }

  function selectParent(parent: Parent) {
    onChange(parent.id);
    setQuery(parent.sku + " - " + parent.name);
    setOpen(false);
  }

  return (
    <div className="w-72">
      <div className="flex items-center rounded-xl border bg-white px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onBlur={() => setOpen(false)}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder="Search parent SKU or product name"
          className="w-full px-2 py-2 text-sm outline-none"
        />
      </div>

      {open ? (
        <div
          className="mt-2 max-h-56 overflow-y-auto rounded-2xl border bg-slate-50 shadow-sm"
          onMouseDown={(event) => event.preventDefault()}
        >
          {filteredParents.map((parent) => (
            <button
              key={parent.id}
              type="button"
              onClick={() => selectParent(parent)}
              className={
                "flex w-full flex-col items-start border-b px-4 py-3 text-left last:border-b-0 hover:bg-slate-100 " +
                (parent.id === value ? "bg-slate-100" : "")
              }
            >
              <span className="text-sm font-semibold text-slate-900">
                {parent.sku}
              </span>
              <span className="text-xs text-slate-500">{parent.name}</span>
            </button>
          ))}

          {!filteredParents.length ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              No Product Parent found.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


function sameMapping(a: Campaign, b: Campaign) {
  if (!a.mapping || !b.mapping) return false;
  if (a.mapping.productParentId !== b.mapping.productParentId) return false;

  const aSources = [...a.mapping.sourceIds].sort();
  const bSources = [...b.mapping.sourceIds].sort();

  return (
    aSources.length === bSources.length &&
    aSources.every((sourceId, index) => sourceId === bSources[index])
  );
}

function CampaignConnectionPicker({
  campaign,
  campaigns,
  pending,
  onConnect,
  onDisconnect,
}: {
  campaign: Campaign;
  campaigns: Campaign[];
  pending: boolean;
  onConnect: (campaignId: string, targetCampaignId: string) => void;
  onDisconnect: (campaignId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();

    return campaigns
      .filter(
        (candidate) =>
          candidate.id !== campaign.id &&
          sameMapping(campaign, candidate)
      )
      .filter(
        (candidate) =>
          !q ||
          candidate.campaignName.toLowerCase().includes(q) ||
          candidate.account.name.toLowerCase().includes(q) ||
          candidate.metaCampaignId.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [campaign, campaigns, query]);

  if (!campaign.mapping) {
    return (
      <div className="w-72 rounded-xl border border-dashed p-3 text-xs text-slate-500">
        Map Product Parent and Source first, then update mappings before connecting campaigns.
      </div>
    );
  }

  if (campaign.mapping.reportGroupId) {
    return (
      <div className="w-72 rounded-xl border bg-emerald-50 p-3">
        <p className="text-xs font-semibold text-emerald-800">
          Connected campaign group
        </p>
        <div className="mt-2 space-y-1">
          {campaign.mapping.linkedCampaigns.map((linked) => (
            <p key={linked.id} className="text-xs text-emerald-700">
              • {linked.campaignName}
            </p>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDisconnect(campaign.id)}
          className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
        >
          Disconnect from group
        </button>
      </div>
    );
  }

  return (
    <div className="w-72">
      <div className="rounded-xl border bg-white px-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search existing mapped campaign..."
          className="w-full py-2 text-sm outline-none"
        />
      </div>

      {query ? (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border bg-white shadow-sm">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setQuery("");
                onConnect(campaign.id, candidate.id);
              }}
              className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 disabled:opacity-50"
            >
              <p className="text-xs font-semibold text-slate-900">
                {candidate.campaignName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {candidate.account.name}
              </p>
            </button>
          ))}

          {!candidates.length ? (
            <div className="px-3 py-3 text-xs text-slate-500">
              No mapped campaign with the same Product Parent + Sources.
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">
          Connect campaigns only when they share the same Product Parent and Sources.
        </p>
      )}
    </div>
  );
}

export default function AdsCostSyncClient({
  configured,
  from,
  to,
  selectedAccountId,
  flash,
  parents,
  sources,
  connections,
  campaigns,
  summary,
  syncRuns,
}: {
  configured: boolean;
  from: string;
  to: string;
  selectedAccountId: string;
  flash: { connected: boolean; accounts: number; error: string };
  parents: Parent[];
  sources: Source[];
  connections: Connection[];
  campaigns: Campaign[];
  summary: {
    totalAccounts: number;
    enabledAccounts: number;
    campaigns: number;
    mapped: number;
    unmapped: number;
    spends: { currency: string; amount: number }[];
  };
  syncRuns: {
    id: string;
    accountName: string;
    metaAccountId: string | null;
    mode: string;
    fromDate: string;
    toDate: string;
    status: string;
    campaignsSeen: number;
    rowsSynced: number;
    message: string | null;
    startedAt: string;
    finishedAt: string | null;
  }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(
    flash.error
      ? flash.error
      : flash.connected
        ? "Meta connected. " + flash.accounts + " ad account(s) discovered."
        : ""
  );
  const [syncFrom, setSyncFrom] = useState(from);
  const [syncTo, setSyncTo] = useState(to);
  const [syncAccountId, setSyncAccountId] = useState(selectedAccountId);
  const [filter, setFilter] = useState<"ALL" | "MAPPED" | "UNMAPPED">("ALL");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      campaigns.map((campaign) => [
        campaign.id,
        {
          productParentId: campaign.mapping?.productParentId || "",
          sourceIds: campaign.mapping?.sourceIds || [],
        },
      ])
    )
  );

  const accounts = useMemo(
    () => connections.flatMap((connection) => connection.accounts),
    [connections]
  );

  const visibleCampaigns = useMemo(() => {
    const q = search.toLowerCase().trim();
    return campaigns.filter((campaign) => {
      if (filter === "MAPPED" && !campaign.mapping) return false;
      if (filter === "UNMAPPED" && campaign.mapping) return false;
      if (
        q &&
        !(
          campaign.campaignName.toLowerCase().includes(q) ||
          campaign.metaCampaignId.toLowerCase().includes(q) ||
          campaign.account.name.toLowerCase().includes(q) ||
          campaign.account.metaAccountId.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [campaigns, filter, search]);

  function patchDraft(campaignId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [campaignId]: {
        ...(current[campaignId] || { productParentId: "", sourceIds: [] }),
        ...patch,
      },
    }));
  }

  const dirtyMappings = useMemo(() => {
    function normalizeIds(values: string[]) {
      return [...new Set(values)].sort();
    }

    return campaigns
      .map((campaign) => {
        const draft = drafts[campaign.id] || {
          productParentId: "",
          sourceIds: [],
        };
        const originalParentId = campaign.mapping?.productParentId || "";
        const originalSourceIds = normalizeIds(campaign.mapping?.sourceIds || []);
        const draftSourceIds = normalizeIds(draft.sourceIds || []);

        const parentChanged = draft.productParentId !== originalParentId;
        const sourcesChanged =
          originalSourceIds.length !== draftSourceIds.length ||
          originalSourceIds.some((id, index) => id !== draftSourceIds[index]);

        return {
          campaignId: campaign.id,
          productParentId: draft.productParentId,
          sourceIds: draftSourceIds,
          changed: parentChanged || sourcesChanged,
        };
      })
      .filter((row) => row.changed);
  }, [campaigns, drafts]);

  const invalidDirtyMappings = useMemo(
    () =>
      dirtyMappings.filter((row) => {
        const removing = !row.productParentId && row.sourceIds.length === 0;
        return !removing && (!row.productParentId || !row.sourceIds.length);
      }),
    [dirtyMappings]
  );

  function handleSaveAllMappings() {
    if (!dirtyMappings.length) {
      setMessage("No mapping changes to update.");
      return;
    }

    if (invalidDirtyMappings.length) {
      setMessage(
        invalidDirtyMappings.length +
          " changed campaign(s) need both a Product Parent and at least one Source."
      );
      return;
    }

    setMessage("");
    startTransition(async () => {
      const result = await saveMetaCampaignMappings({
        mappings: dirtyMappings.map((row) => ({
          campaignId: row.campaignId,
          productParentId: row.productParentId,
          sourceIds: row.sourceIds,
        })),
      });
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  function handleConnectCampaign(
    campaignId: string,
    targetCampaignId: string
  ) {
    setMessage("");
    startTransition(async () => {
      const result = await connectMetaCampaignToExisting({
        campaignId,
        targetCampaignId,
      });
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  function handleDisconnectCampaign(campaignId: string) {
    setMessage("");
    startTransition(async () => {
      const result = await disconnectMetaCampaignReportGroup(campaignId);
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  function handleSync() {
    setMessage("");
    startTransition(async () => {
      const result = await syncMetaAdsNow({
        accountId: syncAccountId || undefined,
        fromDate: syncFrom,
        toDate: syncTo,
      });
      setMessage(result.message);
      window.location.assign(
        "/dashboard/ads-cost/sync?from=" +
          encodeURIComponent(syncFrom) +
          "&to=" +
          encodeURIComponent(syncTo) +
          (syncAccountId ? "&accountId=" + encodeURIComponent(syncAccountId) : "")
      );
    });
  }

  function handleToggle(accountId: string, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleMetaAdAccount(accountId, enabled);
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  function handleDisconnect(connectionId: string) {
    if (!window.confirm("Disconnect this Meta login? Historical spend and mappings will remain.")) {
      return;
    }
    startTransition(async () => {
      const result = await disconnectMetaConnection(connectionId);
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {!configured ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Meta app configuration is required.</p>
          <p className="mt-1">
            Add META_ADS_APP_ID and META_ADS_APP_SECRET in Railway, then add this callback URL in your Meta app:
            <span className="ml-1 font-mono">/api/meta-ads/callback</span>
          </p>
        </section>
      ) : null}

      {message ? (
        <section className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Summary title="Ad Accounts" value={String(summary.totalAccounts)} />
        <Summary title="Enabled" value={String(summary.enabledAccounts)} />
        <Summary title="Campaigns" value={String(summary.campaigns)} />
        <Summary title="Mapped" value={String(summary.mapped)} />
        <Summary title="Unmapped" value={String(summary.unmapped)} />
        <Summary
          title="Spend"
          value={
            summary.spends.length
              ? summary.spends.map((item) => amount(item.amount, item.currency)).join(" + ")
              : "0"
          }
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Meta Connections</h2>
            <p className="mt-1 text-sm text-slate-500">
              Multiple Meta logins and multiple ad accounts are supported.
            </p>
          </div>
          <a
            href={configured ? "/api/meta-ads/connect" : "#"}
            className={
              "rounded-xl px-4 py-2.5 text-sm font-semibold " +
              (configured
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-slate-200 text-slate-500")
            }
            onClick={(event) => {
              if (!configured) event.preventDefault();
            }}
          >
            Connect Facebook / Meta
          </a>
        </div>

        <div className="mt-5 space-y-4">
          {connections.map((connection) => (
            <div key={connection.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {connection.metaUserName || "Meta User"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Meta User ID: {connection.metaUserId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Token expires: {formatDateTime(connection.tokenExpiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending || !connection.status}
                  onClick={() => handleDisconnect(connection.id)}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                >
                  {connection.status ? "Disconnect" : "Disconnected"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {connection.accounts.map((account) => (
                  <div key={account.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">
                          {account.metaAccountId} · {account.currency}
                          {account.timezoneName ? " · " + account.timezoneName : ""}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={account.enabled}
                          disabled={pending || !connection.status}
                          onChange={(event) =>
                            handleToggle(account.id, event.target.checked)
                          }
                        />
                        Sync
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Last sync: {formatDateTime(account.lastSyncAt)}
                    </p>
                    {account.lastSyncStatus ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {account.lastSyncStatus}
                        {account.lastSyncMessage ? " · " + account.lastSyncMessage : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!connections.length ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
              No Meta connection yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sync Spend</h2>
        <p className="mt-1 text-sm text-slate-500">
          Automatic sync runs after 2:00 AM Bangladesh time and re-syncs the last 3 completed days. You can also sync manually.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="From">
            <input
              type="date"
              value={syncFrom}
              onChange={(event) => setSyncFrom(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={syncTo}
              onChange={(event) => setSyncTo(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </Field>
          <Field label="Ad Account">
            <select
              value={syncAccountId}
              onChange={(event) => setSyncAccountId(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            >
              <option value="">All enabled accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.metaAccountId})
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending || !configured || !accounts.length}
              onClick={handleSync}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Working..." : "Sync Now"}
            </button>
          </div>
        </div>

        <form className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <input type="hidden" name="from" value={syncFrom} />
          <input type="hidden" name="to" value={syncTo} />
          {syncAccountId ? (
            <input type="hidden" name="accountId" value={syncAccountId} />
          ) : null}
          <button
            type="submit"
            className="rounded-lg border px-3 py-1.5 font-medium text-slate-700"
          >
            Apply dates to campaign spend
          </button>
          <span>
            Campaign spend below is currently {from} to {to}.
          </span>
        </form>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Campaign Mapping</h2>
              <p className="mt-1 text-sm text-slate-500">
                Map as many campaigns as you need, then save all changed mappings together from the button at the bottom.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "UNMAPPED", "MAPPED"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    "rounded-lg px-3 py-2 text-xs font-semibold " +
                    (filter === value
                      ? "bg-slate-900 text-white"
                      : "border bg-white text-slate-700")
                  }
                >
                  {value === "ALL" ? "All" : value === "MAPPED" ? "Mapped" : "Unmapped"}
                </button>
              ))}
            </div>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search campaign or ad account..."
            className="mt-4 w-full max-w-xl rounded-xl border px-3 py-2.5 text-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Ad Account / Campaign</Th>
                <Th>Spend</Th>
                <Th>Product Parent</Th>
                <Th>Sources (multiple)</Th>
                <Th>Connect Existing Ad</Th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign) => {
                const draft = drafts[campaign.id] || {
                  productParentId: "",
                  sourceIds: [],
                };

                return (
                  <tr key={campaign.id} className="border-b align-top last:border-b-0">
                    <td className="px-4 py-4 text-sm">
                      <p className="font-semibold text-slate-900">{campaign.campaignName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {campaign.account.name} · {campaign.account.metaAccountId}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Campaign ID: {campaign.metaCampaignId}
                      </p>
                    </td>
                    <Td>{amount(campaign.spend, campaign.account.currency)}</Td>
                    <td className="px-4 py-4">
                      <SearchableParentPicker
                        parents={parents}
                        value={draft.productParentId}
                        onChange={(productParentId) =>
                          patchDraft(campaign.id, { productParentId })
                        }
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-h-40 w-64 overflow-y-auto rounded-xl border p-2">
                        {sources.map((source) => {
                          const checked = draft.sourceIds.includes(source.id);
                          return (
                            <label
                              key={source.id}
                              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const next = event.target.checked
                                    ? [...draft.sourceIds, source.id]
                                    : draft.sourceIds.filter((id) => id !== source.id);
                                  patchDraft(campaign.id, {
                                    sourceIds: Array.from(new Set(next)),
                                  });
                                }}
                              />
                              <span>
                                {source.name}
                                <span className="ml-1 text-slate-400">({source.type})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <CampaignConnectionPicker
                        campaign={campaign}
                        campaigns={campaigns}
                        pending={pending}
                        onConnect={handleConnectCampaign}
                        onDisconnect={handleDisconnectCampaign}
                      />
                    </td>
                  </tr>
                );
              })}

              {!visibleCampaigns.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No campaigns found. Connect Meta and run Sync Now first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {dirtyMappings.length} unsaved mapping change{dirtyMappings.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Map campaigns anywhere in the list. Nothing is written until you press Update All Mappings.
            </p>
            {invalidDirtyMappings.length ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                {invalidDirtyMappings.length} changed campaign(s) are incomplete.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSaveAllMappings}
            disabled={
              pending ||
              !dirtyMappings.length ||
              Boolean(invalidDirtyMappings.length)
            }
            className="min-h-11 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending
              ? "Updating Mappings..."
              : "Update All Mappings" +
                (dirtyMappings.length ? " (" + dirtyMappings.length + ")" : "")}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Sync Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Started</Th>
                <Th>Account</Th>
                <Th>Mode</Th>
                <Th>Date Range</Th>
                <Th>Status</Th>
                <Th>Campaigns</Th>
                <Th>Rows</Th>
                <Th>Message</Th>
              </tr>
            </thead>
            <tbody>
              {syncRuns.map((run) => (
                <tr key={run.id} className="border-b last:border-b-0">
                  <Td>{formatDateTime(run.startedAt)}</Td>
                  <Td>{run.accountName}</Td>
                  <Td>{run.mode}</Td>
                  <Td>{run.fromDate} → {run.toDate}</Td>
                  <Td>{run.status}</Td>
                  <Td>{run.campaignsSeen}</Td>
                  <Td>{run.rowsSynced}</Td>
                  <Td>{run.message || "-"}</Td>
                </tr>
              ))}
              {!syncRuns.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    No sync runs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 break-words text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 " +
        (center ? "text-center" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={
        "px-4 py-4 text-sm text-slate-700 " +
        (center ? "text-center" : "text-left")
      }
    >
      {children}
    </td>
  );
}
