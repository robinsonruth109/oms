"use client";

import {
  Edit3,
  Eye,
  Film,
  ImageIcon,
  MoreHorizontal,
  Package,
  Search,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

export type ReelProductTableItem = {
  id: string;
  caption: string | null;
  descriptionHtml: string | null;
  status: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;

  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;

  product: {
    id: string;
    sku: string;
    name: string;
    sellingPrice: number;
    status: boolean;
    parent: {
      id: string;
      sku: string;
      name: string;
      status: boolean;
    };
  };

  category: {
    id: string;
    name: string;
    status: boolean;
    source: {
      id: string;
      name: string;
      status: boolean;
    };
    page: {
      id: string;
      name: string;
      status: boolean;
    };
  };

  gallery: Array<{
    id: string;
    mediaType: "IMAGE" | "VIDEO";
    url: string;
    publicId: string;
    thumbnailUrl: string | null;
    displayOrder: number;
  }>;
};

type ReelProductTableProps = {
  items: ReelProductTableItem[];
  loading?: boolean;
  disabled?: boolean;
  onEdit: (item: ReelProductTableItem) => void;
  onPreview?: (item: ReelProductTableItem) => void;
  onDelete: (item: ReelProductTableItem) => void;
};

export default function ReelProductTable({
  items,
  loading = false,
  disabled = false,
  onEdit,
  onPreview,
  onDelete,
}: ReelProductTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  const filteredItems = useMemo(() => {
    const searchValue = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.status) ||
        (statusFilter === "INACTIVE" && !item.status);

      if (!matchesStatus) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return [
        item.caption ?? "",
        item.product.name,
        item.product.sku,
        item.product.parent.name,
        item.product.parent.sku,
        item.category.name,
        item.category.source.name,
        item.category.page.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [items, query, statusFilter]);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Reel Products
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage products displayed in the seller reels
            feed.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search product, SKU or category"
              className="h-10 w-full rounded-xl border bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-slate-500 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "ALL"
                  | "ACTIVE"
                  | "INACTIVE"
              )
            }
            className="h-10 rounded-xl border bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableLoadingState />
      ) : filteredItems.length ? (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <TableHeader>Reel</TableHeader>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Gallery</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Order</TableHeader>
                  <TableHeader>Updated</TableHeader>

                  <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => (
                  <DesktopRow
                    key={item.id}
                    item={item}
                    disabled={disabled}
                    onEdit={onEdit}
                    onPreview={onPreview}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y lg:hidden">
            {filteredItems.map((item) => (
              <MobileCard
                key={item.id}
                item={item}
                disabled={disabled}
                onEdit={onEdit}
                onPreview={onPreview}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          hasFilters={
            Boolean(query.trim()) ||
            statusFilter !== "ALL"
          }
        />
      )}

      <div className="flex flex-col gap-1 border-t bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {filteredItems.length} of {items.length} reel
          products
        </p>

        <p>
          Display order is assigned automatically.
        </p>
      </div>
    </section>
  );
}

function DesktopRow({
  item,
  disabled,
  onEdit,
  onPreview,
  onDelete,
}: {
  item: ReelProductTableItem;
  disabled: boolean;
  onEdit: (item: ReelProductTableItem) => void;
  onPreview?: (item: ReelProductTableItem) => void;
  onDelete: (item: ReelProductTableItem) => void;
}) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50/70">
      <td className="px-4 py-4 align-top">
        <ReelThumbnail item={item} />
      </td>

      <td className="px-4 py-4 align-top">
        <div className="max-w-72">
          <p className="truncate text-sm font-semibold text-slate-900">
            {item.product.name}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            SKU: {item.product.sku}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-700">
            ৳{formatMoney(item.product.sellingPrice)}
          </p>

          {!item.product.status ||
          !item.product.parent.status ? (
            <p className="mt-2 text-xs font-medium text-amber-600">
              Linked product is inactive
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="max-w-56">
          <p className="truncate text-sm font-medium text-slate-800">
            {item.category.name}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {item.category.source.name}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {item.category.page.name}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <GallerySummary item={item} />
      </td>

      <td className="px-4 py-4 align-top">
        <StatusBadge active={item.status} />
      </td>

      <td className="px-4 py-4 align-top">
        <span className="inline-flex min-w-9 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {item.displayOrder}
        </span>
      </td>

      <td className="px-4 py-4 align-top">
        <p className="whitespace-nowrap text-xs text-slate-600">
          {formatDate(item.updatedAt)}
        </p>

        <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">
          {formatTime(item.updatedAt)}
        </p>
      </td>

      <td className="px-4 py-4 text-right align-top">
        <RowActions
          item={item}
          disabled={disabled}
          onEdit={onEdit}
          onPreview={onPreview}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function MobileCard({
  item,
  disabled,
  onEdit,
  onPreview,
  onDelete,
}: {
  item: ReelProductTableItem;
  disabled: boolean;
  onEdit: (item: ReelProductTableItem) => void;
  onPreview?: (item: ReelProductTableItem) => void;
  onDelete: (item: ReelProductTableItem) => void;
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <ReelThumbnail item={item} compact />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {item.product.name}
              </p>

              <p className="mt-1 truncate text-xs text-slate-500">
                {item.product.sku}
              </p>
            </div>

            <StatusBadge active={item.status} />
          </div>

          <p className="mt-2 truncate text-xs font-medium text-slate-700">
            {item.category.name}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {item.category.source.name} ·{" "}
            {item.category.page.name}
          </p>
        </div>
      </div>

      {item.caption ? (
        <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">
          {item.caption}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <MobileMetric
          label="Price"
          value={`৳${formatMoney(
            item.product.sellingPrice
          )}`}
        />

        <MobileMetric
          label="Gallery"
          value={String(item.gallery.length)}
        />

        <MobileMetric
          label="Order"
          value={String(item.displayOrder)}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Updated {formatDate(item.updatedAt)}
        </p>

        <RowActions
          item={item}
          disabled={disabled}
          onEdit={onEdit}
          onPreview={onPreview}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

function ReelThumbnail({
  item,
  compact = false,
}: {
  item: ReelProductTableItem;
  compact?: boolean;
}) {
  const sizeClass = compact
    ? "h-20 w-14"
    : "h-24 w-16";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl bg-slate-100 ${sizeClass}`}
    >
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl}
          alt={item.product.name}
          className="h-full w-full object-cover"
        />
      ) : item.videoUrl ? (
        <video
          src={item.videoUrl}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Film className="h-5 w-5 text-slate-400" />
        </div>
      )}

      <div className="absolute bottom-1 right-1 rounded-full bg-slate-950/75 p-1 text-white">
        <Film className="h-3 w-3" />
      </div>
    </div>
  );
}

function GallerySummary({
  item,
}: {
  item: ReelProductTableItem;
}) {
  const imageCount = item.gallery.filter(
    (media) => media.mediaType === "IMAGE"
  ).length;

  const videoCount = item.gallery.filter(
    (media) => media.mediaType === "VIDEO"
  ).length;

  if (!item.gallery.length) {
    return (
      <span className="text-xs text-slate-400">
        No media
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>
          {imageCount} image
          {imageCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <Film className="h-3.5 w-3.5" />
        <span>
          {videoCount} video
          {videoCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function RowActions({
  item,
  disabled,
  onEdit,
  onPreview,
  onDelete,
}: {
  item: ReelProductTableItem;
  disabled: boolean;
  onEdit: (item: ReelProductTableItem) => void;
  onPreview?: (item: ReelProductTableItem) => void;
  onDelete: (item: ReelProductTableItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={disabled}
        aria-label="Open reel product actions"
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border bg-white p-1.5 text-left shadow-xl">
          {onPreview ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPreview(item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit(item);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(item);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function MobileMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function TableLoadingState() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map(
        (_, index) => (
          <div
            key={index}
            className="flex animate-pulse items-center gap-4 rounded-xl border p-3"
          >
            <div className="h-20 w-14 rounded-lg bg-slate-200" />

            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/4 rounded bg-slate-100" />
            </div>

            <div className="hidden h-8 w-20 rounded bg-slate-100 sm:block" />
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        {hasFilters ? (
          <Search className="h-7 w-7 text-slate-400" />
        ) : (
          <Package className="h-7 w-7 text-slate-400" />
        )}
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-800">
        {hasFilters
          ? "No matching reel products"
          : "No reel products created"}
      </p>

      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try changing the search text or selected status."
          : "Create a reel product to start displaying products in the seller reels feed."}
      </p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}