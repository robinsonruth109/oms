"use client";

import {
  ChevronLeft,
  ChevronRight,
  Film,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";

export type ReelGalleryMediaType =
  | "IMAGE"
  | "VIDEO";

export type ReelGalleryItem = {
  /**
   * Database ID for an already-saved gallery record.
   * Newly uploaded items may not have one yet.
   */
  id?: string;

  /**
   * Stable client-side identifier.
   */
  clientId: string;

  mediaType: ReelGalleryMediaType;
  url: string;
  publicId: string;

  thumbnailUrl?: string | null;
  format?: string | null;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;

  /**
   * Position inside the gallery.
   */
  displayOrder: number;

  /**
   * True while this asset is being uploaded.
   */
  uploading?: boolean;

  /**
   * True when the item already exists in the database.
   */
  persisted?: boolean;
};

type GalleryUploaderProps = {
  items: ReelGalleryItem[];
  onChange: (items: ReelGalleryItem[]) => void;

  /**
   * The parent modal will perform the Cloudinary upload,
   * then add the returned media to `items`.
   */
  onUploadImages: (files: File[]) => Promise<void>;
  onUploadVideos: (files: File[]) => Promise<void>;

  /**
   * The parent modal handles Cloudinary deletion when needed.
   */
  onDeleteItem: (
    item: ReelGalleryItem
  ) => Promise<void>;

  disabled?: boolean;
  imageUploading?: boolean;
  videoUploading?: boolean;
  maxItems?: number;
};

const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif";

const VIDEO_ACCEPT =
  "video/mp4,video/webm,video/quicktime,video/x-m4v";

export default function GalleryUploader({
  items,
  onChange,
  onUploadImages,
  onUploadVideos,
  onDeleteItem,
  disabled = false,
  imageUploading = false,
  videoUploading = false,
  maxItems = 12,
}: GalleryUploaderProps) {
  const imageInputRef =
    useRef<HTMLInputElement>(null);

  const videoInputRef =
    useRef<HTMLInputElement>(null);

  const uploadBusy =
    imageUploading || videoUploading;

  const remainingSlots = Math.max(
    maxItems - items.length,
    0
  );

  async function handleImageSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    event.target.value = "";

    if (!files.length || disabled) {
      return;
    }

    const acceptedFiles = files
      .filter((file) =>
        file.type.startsWith("image/")
      )
      .slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      return;
    }

    await onUploadImages(acceptedFiles);
  }

  async function handleVideoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    event.target.value = "";

    if (!files.length || disabled) {
      return;
    }

    const acceptedFiles = files
      .filter((file) =>
        file.type.startsWith("video/")
      )
      .slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      return;
    }

    await onUploadVideos(acceptedFiles);
  }

  function moveItem(
    currentIndex: number,
    direction: -1 | 1
  ) {
    const nextIndex =
      currentIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= items.length
    ) {
      return;
    }

    const nextItems = [...items];

    const currentItem =
      nextItems[currentIndex];

    const targetItem =
      nextItems[nextIndex];

    nextItems[currentIndex] = targetItem;
    nextItems[nextIndex] = currentItem;

    onChange(
      nextItems.map((item, index) => ({
        ...item,
        displayOrder: index,
      }))
    );
  }

  async function removeItem(
    item: ReelGalleryItem
  ) {
    if (disabled || item.uploading) {
      return;
    }

    await onDeleteItem(item);

    const nextItems = items
      .filter(
        (candidate) =>
          candidate.clientId !== item.clientId
      )
      .map((candidate, index) => ({
        ...candidate,
        displayOrder: index,
      }));

    onChange(nextItems);
  }

  return (
    <section className="rounded-2xl border bg-white">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Product Gallery
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Add up to {maxItems} product images or
            videos. The first item will appear first
            in the gallery.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              uploadBusy ||
              remainingSlots === 0
            }
            onClick={() =>
              imageInputRef.current?.click()
            }
          >
            {imageUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}

            Add Images
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              uploadBusy ||
              remainingSlots === 0
            }
            onClick={() =>
              videoInputRef.current?.click()
            }
          >
            {videoUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Film className="mr-2 h-4 w-4" />
            )}

            Add Videos
          </Button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) =>
          void handleImageSelection(event)
        }
      />

      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) =>
          void handleVideoSelection(event)
        }
      />

      <div className="p-4">
        {items.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item, index) => (
              <GalleryCard
                key={item.clientId}
                item={item}
                index={index}
                totalItems={items.length}
                disabled={disabled}
                onMoveLeft={() =>
                  moveItem(index, -1)
                }
                onMoveRight={() =>
                  moveItem(index, 1)
                }
                onDelete={() =>
                  void removeItem(item)
                }
              />
            ))}

            {remainingSlots > 0 ? (
              <button
                type="button"
                disabled={disabled || uploadBusy}
                onClick={() =>
                  imageInputRef.current?.click()
                }
                className="flex aspect-square min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-center transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="rounded-full bg-white p-3 shadow-sm">
                  <Plus className="h-5 w-5 text-slate-500" />
                </div>

                <p className="mt-3 text-sm font-medium text-slate-700">
                  Add media
                </p>

                <p className="mt-1 px-3 text-xs text-slate-500">
                  {remainingSlots} slot
                  {remainingSlots === 1 ? "" : "s"}{" "}
                  remaining
                </p>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 px-4 text-center">
            <div className="rounded-full bg-white p-4 shadow-sm">
              <Upload className="h-7 w-7 text-slate-400" />
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-800">
              No gallery media added
            </p>

            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              Upload product photos or short videos
              that customers can browse after opening
              this reel product.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled ||
                  uploadBusy ||
                  remainingSlots === 0
                }
                onClick={() =>
                  imageInputRef.current?.click()
                }
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Upload Images
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled ||
                  uploadBusy ||
                  remainingSlots === 0
                }
                onClick={() =>
                  videoInputRef.current?.click()
                }
              >
                <Film className="mr-2 h-4 w-4" />
                Upload Videos
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {items.length} of {maxItems} gallery items
            added
          </p>

          <p>
            Use the arrow buttons to change the
            gallery order.
          </p>
        </div>
      </div>
    </section>
  );
}

function GalleryCard({
  item,
  index,
  totalItems,
  disabled,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: {
  item: ReelGalleryItem;
  index: number;
  totalItems: number;
  disabled: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {item.mediaType === "IMAGE" ? (
           
          <img
            src={item.url}
            alt={`Gallery item ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : item.thumbnailUrl ? (
           
          <img
            src={item.thumbnailUrl}
            alt={`Video thumbnail ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-semibold text-white">
          {item.mediaType === "IMAGE" ? (
            <ImageIcon className="h-3 w-3" />
          ) : (
            <Film className="h-3 w-3" />
          )}

          {item.mediaType === "IMAGE"
            ? "IMAGE"
            : "VIDEO"}
        </div>

        <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700 shadow">
          {index + 1}
        </div>

        {item.uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />

            <p className="mt-2 text-xs font-medium">
              Uploading...
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">
            {item.format
              ? item.format.toUpperCase()
              : item.mediaType}
          </p>

          <p className="mt-1 truncate text-[11px] text-slate-500">
            {formatMediaDetails(item)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Move left"
              aria-label="Move gallery item left"
              disabled={
                disabled ||
                item.uploading ||
                index === 0
              }
              onClick={onMoveLeft}
              className="rounded-lg border p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              title="Move right"
              aria-label="Move gallery item right"
              disabled={
                disabled ||
                item.uploading ||
                index === totalItems - 1
              }
              onClick={onMoveRight}
              className="rounded-lg border p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            title="Delete gallery item"
            aria-label="Delete gallery item"
            disabled={disabled || item.uploading}
            onClick={onDelete}
            className="rounded-lg border border-red-200 p-1.5 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function formatMediaDetails(
  item: ReelGalleryItem
) {
  const details: string[] = [];

  if (item.width && item.height) {
    details.push(
      `${item.width} × ${item.height}`
    );
  }

  if (
    item.mediaType === "VIDEO" &&
    item.duration !== null &&
    item.duration !== undefined
  ) {
    details.push(
      formatDuration(item.duration)
    );
  }

  if (
    item.bytes !== null &&
    item.bytes !== undefined
  ) {
    details.push(formatBytes(item.bytes));
  }

  return details.length
    ? details.join(" · ")
    : "Media details unavailable";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const unitIndex = Math.min(
    Math.floor(
      Math.log(bytes) / Math.log(1024)
    ),
    units.length - 1
  );

  const value =
    bytes / Math.pow(1024, unitIndex);

  return `${value.toFixed(
    unitIndex === 0 ? 0 : 1
  )} ${units[unitIndex]}`;
}

function formatDuration(seconds: number) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(
    wholeSeconds / 60
  );
  const remainingSeconds =
    wholeSeconds % 60;

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}