"use client";

import {
  Film,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ReelMainMediaState = {
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string;
  thumbnailPublicId: string;
  videoDuration: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFormat: string | null;
  videoBytes: number | null;
};

type ReelMediaUploaderProps = {
  media: ReelMainMediaState;

  videoUploading?: boolean;
  thumbnailUploading?: boolean;
  disabled?: boolean;

  onSelectVideo: () => void;
  onSelectThumbnail: () => void;

  onRemoveVideo?: () => void;
  onRemoveThumbnail?: () => void;
};

export default function ReelMediaUploader({
  media,
  videoUploading = false,
  thumbnailUploading = false,
  disabled = false,
  onSelectVideo,
  onSelectThumbnail,
  onRemoveVideo,
  onRemoveThumbnail,
}: ReelMediaUploaderProps) {
  const busy =
    videoUploading || thumbnailUploading;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Main Reel Video
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Upload a vertical MP4, WebM, MOV or M4V
              video. Maximum size: 100 MB.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            onClick={onSelectVideo}
          >
            {videoUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}

            {media.videoPublicId
              ? "Replace Video"
              : "Upload Video"}
          </Button>
        </div>

        <div className="p-4">
          {media.videoUrl ? (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video
                  key={media.videoUrl}
                  src={media.videoUrl}
                  poster={media.thumbnailUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video max-h-[520px] w-full object-contain"
                />

                {onRemoveVideo ? (
                  <button
                    type="button"
                    title="Remove main reel video"
                    aria-label="Remove main reel video"
                    disabled={disabled || videoUploading}
                    onClick={onRemoveVideo}
                    className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-red-600 shadow-lg transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}

                {videoUploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white">
                    <Loader2 className="h-7 w-7 animate-spin" />

                    <p className="mt-3 text-sm font-medium">
                      Uploading video...
                    </p>
                  </div>
                ) : null}
              </div>

              <VideoMetadata media={media} />
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={onSelectVideo}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 px-6 text-center transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {videoUploading ? (
                <Loader2 className="h-9 w-9 animate-spin text-slate-400" />
              ) : (
                <div className="rounded-full bg-white p-4 shadow-sm">
                  <Film className="h-8 w-8 text-slate-400" />
                </div>
              )}

              <p className="mt-4 text-sm font-semibold text-slate-800">
                {videoUploading
                  ? "Uploading your reel..."
                  : "Upload the main reel video"}
              </p>

              <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                A 9:16 vertical video is recommended for
                the best experience in the seller reels
                feed.
              </p>
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between xl:items-start">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Custom Thumbnail
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Optional JPG, PNG, WebP or AVIF image.
              Maximum size: 10 MB.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              busy ||
              !media.videoPublicId
            }
            onClick={onSelectThumbnail}
          >
            {thumbnailUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}

            {media.thumbnailPublicId
              ? "Replace"
              : "Upload"}
          </Button>
        </div>

        <div className="p-4">
          {media.thumbnailUrl ? (
            <div className="relative mx-auto w-full max-w-64 overflow-hidden rounded-2xl bg-slate-100">
              { }
              <img
                src={media.thumbnailUrl}
                alt="Reel thumbnail preview"
                className="aspect-[9/16] w-full object-cover"
              />

              {onRemoveThumbnail &&
              media.thumbnailPublicId ? (
                <button
                  type="button"
                  title="Remove custom thumbnail"
                  aria-label="Remove custom thumbnail"
                  disabled={
                    disabled || thumbnailUploading
                  }
                  onClick={onRemoveThumbnail}
                  className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-red-600 shadow-lg transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}

              {thumbnailUploading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white">
                  <Loader2 className="h-7 w-7 animate-spin" />

                  <p className="mt-3 text-xs font-medium">
                    Uploading thumbnail...
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={
                disabled ||
                busy ||
                !media.videoPublicId
              }
              onClick={onSelectThumbnail}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 px-5 text-center transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {thumbnailUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : (
                <div className="rounded-full bg-white p-4 shadow-sm">
                  <ImageIcon className="h-7 w-7 text-slate-400" />
                </div>
              )}

              <p className="mt-4 text-sm font-semibold text-slate-800">
                {thumbnailUploading
                  ? "Uploading thumbnail..."
                  : "No custom thumbnail"}
              </p>

              <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                The thumbnail generated from the main
                video will be used automatically when no
                custom thumbnail is uploaded.
              </p>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function VideoMetadata({
  media,
}: {
  media: ReelMainMediaState;
}) {
  const values: string[] = [];

  if (media.videoFormat) {
    values.push(media.videoFormat.toUpperCase());
  }

  if (
    media.videoDuration !== null &&
    media.videoDuration !== undefined
  ) {
    values.push(formatDuration(media.videoDuration));
  }

  if (
    media.videoWidth !== null &&
    media.videoHeight !== null
  ) {
    values.push(
      `${media.videoWidth} × ${media.videoHeight}`
    );
  }

  if (
    media.videoBytes !== null &&
    media.videoBytes !== undefined
  ) {
    values.push(formatBytes(media.videoBytes));
  }

  if (!values.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
        >
          {value}
        </span>
      ))}
    </div>
  );
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
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}