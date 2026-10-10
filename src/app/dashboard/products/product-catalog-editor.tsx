"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  FileVideo2,
  ImageIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  applyCatalogImportCandidate,
  deleteProductMedia,
  publishProductListing,
  registerProductMedia,
  saveProductCatalogContent,
  saveProductWebsiteListing,
  setPrimaryProductImage,
} from "./catalog-actions";

type TaxonomyTerm = {
  id: string;
  externalId: string;
  type: "CATEGORY" | "SUBCATEGORY" | "COLLECTION";
  parentExternalId: string | null;
  name: string;
  slug: string;
};

type Website = {
  id: string;
  name: string;
  platform: "SHOPIFY" | "LARAVEL";
  catalogMode: "COLLECTION" | "SUBCATEGORY";
  productSyncEnabled: boolean;
  baseUrl: string | null;
  taxonomyTerms: TaxonomyTerm[];
  listing: null | {
    id: string;
    productSlugOverride: string | null;
    sellingPriceOverride: number | null;
    oldPriceOverride: number | null;
    active: boolean;
    featuredOverride: boolean | null;
    remoteProductId: string | null;
    publicUrl: string | null;
    syncStatus: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    taxonomyTermIds: string[];
  };
};

type MediaRow = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  sortOrder: number;
  previewUrl: string | null;
};

type ImportCandidate = {
  id: string;
  websiteName: string;
  externalProductId: string;
  status: string;
  updatedAt: string;
};

type Props = {
  product: {
    id: string;
    sku: string;
    name: string;
    sellingPrice: number;
    content: {
      banglaName: string;
      englishName: string;
      productSlug: string;
      shortDescriptionHtml: string;
      fullDescriptionHtml: string;
      oldPrice: number | null;
      featured: boolean;
      sortOrder: number;
      metaTitle: string;
      metaDescription: string;
      externalVideoUrl: string;
    };
  };
  websites: Website[];
  media: MediaRow[];
  importCandidates: ImportCandidate[];
  bucketConfigured: boolean;
};

async function sha256(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function money(value: number | null) {
  return value === null
    ? ""
    : Number(value).toFixed(2).replace(/\.00$/, "");
}

export default function ProductCatalogEditor({
  product,
  websites,
  media,
  importCandidates,
  bucketConfigured,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const [banglaName, setBanglaName] = useState(product.content.banglaName);
  const [englishName, setEnglishName] = useState(product.content.englishName);
  const [productSlug, setProductSlug] = useState(product.content.productSlug);
  const [oldPrice, setOldPrice] = useState(
    product.content.oldPrice === null ? "" : String(product.content.oldPrice)
  );
  const [featured, setFeatured] = useState(product.content.featured);
  const [sortOrder, setSortOrder] = useState(product.content.sortOrder);
  const [shortHtml, setShortHtml] = useState(
    product.content.shortDescriptionHtml
  );
  const [fullHtml, setFullHtml] = useState(product.content.fullDescriptionHtml);
  const [metaTitle, setMetaTitle] = useState(product.content.metaTitle);
  const [metaDescription, setMetaDescription] = useState(
    product.content.metaDescription
  );
  const [externalVideoUrl, setExternalVideoUrl] = useState(
    product.content.externalVideoUrl
  );

  const images = useMemo(
    () => media.filter((row) => row.kind === "IMAGE"),
    [media]
  );
  const videos = useMemo(
    () => media.filter((row) => row.kind === "VIDEO"),
    [media]
  );

  function showResult(result: { success: boolean; message: string }) {
    setMessage(result.message);
    if (result.success) window.location.reload();
  }

  async function upload(file: File, primary = false) {
    if (!bucketConfigured) {
      setMessage(
        "Railway media bucket is not configured on the OMS service yet."
      );
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const prep = await fetch("/api/product-media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          originalFileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const prepared = (await prep.json()) as {
        success: boolean;
        message?: string;
        kind?: "IMAGE" | "VIDEO";
        objectKey?: string;
        uploadUrl?: string;
      };

      if (!prep.ok || !prepared.success || !prepared.uploadUrl || !prepared.objectKey || !prepared.kind) {
        throw new Error(prepared.message || "Could not prepare media upload.");
      }

      const checksum = await sha256(file);
      const put = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!put.ok) {
        throw new Error("Railway bucket upload failed with HTTP " + put.status + ".");
      }

      const result = await registerProductMedia({
        productId: product.id,
        kind: prepared.kind,
        objectKey: prepared.objectKey,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        checksum,
        isPrimary: primary,
      });
      showResult(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Media upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-950">
          Website Content & Publishing
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {product.sku} · OMS is the master copy for content, media and website
          publishing. Inventory remains controlled by the existing Product Master
          stock engine.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="rounded-2xl border p-4 sm:p-5">
        <h3 className="font-bold text-slate-950">Master Product Content</h3>
        <p className="mt-1 text-xs text-slate-500">
          Manual slugs preserve Bangla, English, emoji, numbers and hyphens. OMS
          never transliterates or regenerates a manually entered slug.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Bangla Name" value={banglaName} onChange={setBanglaName} />
          <Field label="English Name" value={englishName} onChange={setEnglishName} />
          <Field
            label="Product URL Slug"
            value={productSlug}
            onChange={setProductSlug}
            className="md:col-span-2"
            placeholder="Bangla / English / emoji slug supported"
          />
          <Field
            label="Old Price"
            value={oldPrice}
            onChange={setOldPrice}
            type="number"
          />
          <Field
            label="Sort Order"
            value={String(sortOrder)}
            onChange={(value) => setSortOrder(Number(value || 0))}
            type="number"
          />

          <label className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
            />
            Featured Product
          </label>

          <Field
            label="External Video URL"
            value={externalVideoUrl}
            onChange={setExternalVideoUrl}
            placeholder="YouTube / Vimeo / direct URL"
          />

          <TextArea
            label="Short Description HTML"
            value={shortHtml}
            onChange={setShortHtml}
            className="md:col-span-2"
            rows={7}
          />
          <TextArea
            label="Full Product Details HTML"
            value={fullHtml}
            onChange={setFullHtml}
            className="md:col-span-2"
            rows={12}
          />

          <Field label="Meta Title" value={metaTitle} onChange={setMetaTitle} />
          <TextArea
            label="Meta Description"
            value={metaDescription}
            onChange={setMetaDescription}
            rows={4}
          />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () =>
              showResult(
                await saveProductCatalogContent({
                  productId: product.id,
                  banglaName,
                  englishName,
                  productSlug,
                  shortDescriptionHtml: shortHtml,
                  fullDescriptionHtml: fullHtml,
                  oldPrice: oldPrice === "" ? null : Number(oldPrice),
                  featured,
                  sortOrder,
                  metaTitle,
                  metaDescription,
                  externalVideoUrl,
                })
              )
            )
          }
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save Website Content"}
        </button>
      </div>

      <div className="rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">Product Images & Videos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Originals are stored in the Railway bucket. Laravel downloads a
              temporary signed URL and keeps its own local storefront copy.
            </p>
          </div>
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-semibold " +
              (bucketConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800")
            }
          >
            {bucketConfigured ? "RAILWAY BUCKET READY" : "BUCKET NOT CONFIGURED"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="cursor-pointer rounded-2xl border border-dashed p-4 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2 font-semibold">
              <ImageIcon className="h-4 w-4" /> Upload Image
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              JPG, PNG, WebP, GIF · max 12 MB
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading || !bucketConfigured}
              className="mt-3 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file, images.length === 0);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <label className="cursor-pointer rounded-2xl border border-dashed p-4 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2 font-semibold">
              <FileVideo2 className="h-4 w-4" /> Upload Video
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              MP4 / WebM / MOV · max 60 MB
            </span>
            <input
              type="file"
              accept="video/*"
              disabled={uploading || !bucketConfigured}
              className="mt-3 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {uploading ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <CloudUpload className="h-4 w-4 animate-pulse" /> Uploading directly
            to Railway bucket…
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((row) => (
            <div key={row.id} className="overflow-hidden rounded-2xl border bg-slate-50">
              <div className="flex h-44 items-center justify-center bg-white">
                {row.previewUrl && row.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.previewUrl}
                    alt={row.originalFileName}
                    className="h-full w-full object-contain"
                  />
                ) : row.previewUrl && row.kind === "VIDEO" ? (
                  <video
                    src={row.previewUrl}
                    controls
                    preload="metadata"
                    className="h-full w-full"
                  />
                ) : row.kind === "IMAGE" ? (
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                ) : (
                  <FileVideo2 className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {row.originalFileName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {(row.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  {row.isPrimary ? " · MAIN IMAGE" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.kind === "IMAGE" && !row.isPrimary ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () =>
                          showResult(await setPrimaryProductImage(row.id))
                        )
                      }
                      className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold"
                    >
                      Set Main
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Delete this Product Master media file?")) return;
                      startTransition(async () =>
                        showResult(await deleteProductMedia(row.id))
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!media.length ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
              No Product Master media uploaded yet.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border p-4 sm:p-5">
        <h3 className="font-bold text-slate-950">Publish to Websites</h3>
        <p className="mt-1 text-xs text-slate-500">
          Select any number of websites. Collection and Subcategory websites use
          the same raw Unicode taxonomy slug; only the route prefix differs.
        </p>

        <div className="mt-4 space-y-4">
          {websites.map((website) => (
            <WebsiteCard
              key={website.id}
              productId={product.id}
              website={website}
              baseSellingPrice={product.sellingPrice}
              pending={pending}
              run={(work) => startTransition(async () => showResult(await work()))}
            />
          ))}
          {!websites.length ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No active website integrations exist. Configure one in Integrations first.
            </p>
          ) : null}
        </div>
      </div>

      {importCandidates.length ? (
        <div className="rounded-2xl border p-4 sm:p-5">
          <h3 className="font-bold text-slate-950">
            Existing Website Products Matched by SKU
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Importing website content never changes OMS physical stock, stock
            verification, purchase cost or bundle recipe.
          </p>
          <div className="mt-3 space-y-2">
            {importCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {candidate.websiteName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Remote ID {candidate.externalProductId} · scanned{" "}
                    {candidate.updatedAt}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () =>
                      showResult(
                        await applyCatalogImportCandidate(candidate.id)
                      )
                    )
                  }
                  className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                >
                  Import Current Website Content
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WebsiteCard({
  productId,
  website,
  baseSellingPrice,
  pending,
  run,
}: {
  productId: string;
  website: Website;
  baseSellingPrice: number;
  pending: boolean;
  run: (work: () => Promise<{ success: boolean; message: string }>) => void;
}) {
  const [enabled, setEnabled] = useState(Boolean(website.listing));
  const [slug, setSlug] = useState(website.listing?.productSlugOverride || "");
  const [sellPrice, setSellPrice] = useState(
    money(website.listing?.sellingPriceOverride ?? null)
  );
  const [oldPrice, setOldPrice] = useState(
    money(website.listing?.oldPriceOverride ?? null)
  );
  const [active, setActive] = useState(website.listing?.active ?? true);
  const [featuredMode, setFeaturedMode] = useState(
    website.listing?.featuredOverride === true
      ? "yes"
      : website.listing?.featuredOverride === false
        ? "no"
        : "inherit"
  );
  const [terms, setTerms] = useState<string[]>(
    website.listing?.taxonomyTermIds || []
  );

  const groups = {
    CATEGORY: website.taxonomyTerms.filter((term) => term.type === "CATEGORY"),
    SUBCATEGORY: website.taxonomyTerms.filter(
      (term) => term.type === "SUBCATEGORY"
    ),
    COLLECTION: website.taxonomyTerms.filter(
      (term) => term.type === "COLLECTION"
    ),
  };

  function toggleTerm(id: string, checked: boolean) {
    setTerms((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((value) => value !== id)
    );
  }

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-bold text-slate-950">{website.name}</span>
            <span className="mt-1 block text-xs text-slate-500">
              Engine {website.platform} ·{" "}
              {website.catalogMode === "COLLECTION"
                ? "/collections/{slug}"
                : "/subcategory/{slug}"}
            </span>
          </span>
        </label>

        <span
          className={
            "rounded-full px-2.5 py-1 text-xs font-semibold " +
            (website.listing?.syncStatus === "SYNCED"
              ? "bg-emerald-100 text-emerald-700"
              : website.listing?.syncStatus === "FAILED"
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-200 text-slate-700")
          }
        >
          {website.listing?.syncStatus || "NOT SELECTED"}
        </span>
      </div>

      {enabled ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field
              label="Product Slug Override"
              value={slug}
              onChange={setSlug}
              placeholder="Blank = master product slug"
            />
            <Field
              label={"Selling Price Override (master " + baseSellingPrice + ")"}
              value={sellPrice}
              onChange={setSellPrice}
              type="number"
              placeholder="Blank = master selling price"
            />
            <Field
              label="Old Price Override"
              value={oldPrice}
              onChange={setOldPrice}
              type="number"
              placeholder="Blank = master old price"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Active on this website
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-slate-600">
                Featured
              </span>
              <select
                value={featuredMode}
                onChange={(event) => setFeaturedMode(event.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2.5"
              >
                <option value="inherit">Use Master Setting</option>
                <option value="yes">Featured</option>
                <option value="no">Not Featured</option>
              </select>
            </label>
          </div>

          {website.catalogMode === "COLLECTION" ? (
            <TaxonomyGroup
              title="Collections"
              rows={groups.COLLECTION}
              selected={terms}
              toggle={toggleTerm}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <TaxonomyGroup
                title="Categories"
                rows={groups.CATEGORY}
                selected={terms}
                toggle={toggleTerm}
              />
              <TaxonomyGroup
                title="Subcategories"
                rows={groups.SUBCATEGORY}
                selected={terms}
                toggle={toggleTerm}
              />
            </div>
          )}

          {!website.taxonomyTerms.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No taxonomy synced yet. Open Integrations and click Sync Categories /
              Collections after the Laravel API is installed.
            </p>
          ) : null}
        </div>
      ) : null}

      {website.listing?.lastSyncError ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {website.listing.lastSyncError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveProductWebsiteListing({
                productId,
                integrationId: website.id,
                enabled,
                productSlugOverride: slug,
                sellingPriceOverride:
                  sellPrice === "" ? null : Number(sellPrice),
                oldPriceOverride: oldPrice === "" ? null : Number(oldPrice),
                active,
                featuredOverride:
                  featuredMode === "inherit"
                    ? null
                    : featuredMode === "yes",
                taxonomyTermIds: terms,
              })
            )
          }
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save Website Assignment
        </button>

        {website.listing && enabled ? (
          <button
            type="button"
            disabled={pending || !website.productSyncEnabled}
            onClick={() =>
              run(() => publishProductListing(website.listing!.id))
            }
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Sync Now
          </button>
        ) : null}

        {website.listing?.publicUrl ? (
          <a
            href={website.listing.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Website
          </a>
        ) : null}

        {website.listing?.syncStatus === "SYNCED" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />{" "}
            {website.listing.lastSyncedAt || "Synced"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TaxonomyGroup({
  title,
  rows,
  selected,
  toggle,
}: {
  title: string;
  rows: TaxonomyTerm[];
  selected: string[];
  toggle: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <label
            key={row.id}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={(event) => toggle(row.id, event.target.checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block font-semibold text-slate-800">
                {row.name}
              </span>
              <span className="block break-all text-slate-400">
                {row.slug}
              </span>
            </span>
          </label>
        ))}
        {!rows.length ? (
          <p className="px-2 py-3 text-xs text-slate-400">None synced.</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  className?: string;
}) {
  return (
    <label className={"space-y-1.5 text-sm text-slate-700 " + className}>
      <span className="font-medium">{label}</span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  className?: string;
}) {
  return (
    <label className={"space-y-1.5 text-sm text-slate-700 " + className}>
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full resize-y rounded-xl border px-3 py-2.5 font-mono text-sm"
      />
    </label>
  );
}
