import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  createOptimisedReelVideoUrl,
  createReelThumbnailUrl,
  getReelFolder,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES_PER_REQUEST = 10;
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/mpeg",
]);

type UploadKind =
  | "reel-video"
  | "thumbnail"
  | "gallery-image"
  | "gallery-video";

type CloudinaryResourceType = "image" | "video";

type UploadedAsset = {
  mediaKind: UploadKind;
  mediaType: "IMAGE" | "VIDEO";
  resourceType: CloudinaryResourceType;
  url: string;
  publicId: string;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bytes: number | null;
  originalFilename: string;
  thumbnailUrl: string | null;
};

async function requireAdmin() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  return Boolean(session && session.user.role === "ADMIN");
}

function normaliseUploadKind(value: FormDataEntryValue | null): UploadKind | null {
  const kind = String(value || "")
    .trim()
    .toLowerCase();

  switch (kind) {
    case "reel-video":
    case "thumbnail":
    case "gallery-image":
    case "gallery-video":
      return kind;

    default:
      return null;
  }
}

function getUploadKind(formData: FormData): UploadKind | null {
  return (
    normaliseUploadKind(formData.get("mediaKind")) ||
    normaliseUploadKind(formData.get("uploadKind")) ||
    normaliseUploadKind(formData.get("kind"))
  );
}

function getResourceType(kind: UploadKind): CloudinaryResourceType {
  return kind === "reel-video" || kind === "gallery-video"
    ? "video"
    : "image";
}

function getMediaType(kind: UploadKind): "IMAGE" | "VIDEO" {
  return getResourceType(kind) === "video" ? "VIDEO" : "IMAGE";
}

function getFolderSegment(kind: UploadKind) {
  switch (kind) {
    case "reel-video":
      return "videos";

    case "thumbnail":
      return "thumbnails";

    case "gallery-image":
      return "gallery/images";

    case "gallery-video":
      return "gallery/videos";
  }
}

function getMaximumFileSize(resourceType: CloudinaryResourceType) {
  return resourceType === "video"
    ? MAX_VIDEO_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
}

function formatMaximumFileSize(resourceType: CloudinaryResourceType) {
  return resourceType === "video" ? "100 MB" : "15 MB";
}

function isMimeTypeAllowed(
  mimeType: string,
  resourceType: CloudinaryResourceType
) {
  if (resourceType === "video") {
    return ALLOWED_VIDEO_MIME_TYPES.has(mimeType);
  }

  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

function sanitiseFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "");

  const sanitised = withoutExtension
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return sanitised || "media";
}

function collectFiles(formData: FormData): File[] {
  const files = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((value): value is File => value instanceof File && value.size > 0);

  const uniqueFiles: File[] = [];
  const seenFiles = new Set<string>();

  for (const file of files) {
    const signature = [
      file.name,
      file.size,
      file.type,
      file.lastModified,
    ].join(":");

    if (!seenFiles.has(signature)) {
      seenFiles.add(signature);
      uniqueFiles.push(file);
    }
  }

  return uniqueFiles;
}

function validateFile(file: File, kind: UploadKind): string | null {
  const resourceType = getResourceType(kind);
  const maximumFileSize = getMaximumFileSize(resourceType);

  if (!file.name.trim()) {
    return "The uploaded file does not have a valid filename.";
  }

  if (!file.type) {
    return `${file.name}: the file type could not be detected.`;
  }

  if (!isMimeTypeAllowed(file.type, resourceType)) {
    return resourceType === "video"
      ? `${file.name}: only MP4, WebM, MOV, M4V and MPEG videos are allowed.`
      : `${file.name}: only JPG, PNG, WebP, AVIF and GIF images are allowed.`;
  }

  if (file.size > maximumFileSize) {
    return `${file.name}: maximum ${resourceType} size is ${formatMaximumFileSize(
      resourceType
    )}.`;
  }

  return null;
}

async function uploadFile(
  file: File,
  kind: UploadKind
): Promise<UploadedAsset> {
  const resourceType = getResourceType(kind);
  const folder = [
    getReelFolder().replace(/^\/+|\/+$/g, ""),
    getFolderSegment(kind),
  ].join("/");

  const publicId = [
    sanitiseFilename(file.name),
    Date.now(),
    randomUUID(),
  ].join("-");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await uploadBufferToCloudinary(buffer, {
    resource_type: resourceType,
    folder,
    public_id: publicId,
    type: "upload",
    overwrite: false,
    unique_filename: false,
    use_filename: false,
  });

  const uploadedPublicId = result.public_id;

  if (!uploadedPublicId) {
    throw new Error("Cloudinary did not return a public ID.");
  }

  let url = result.secure_url;

  if (kind === "reel-video") {
    url = createOptimisedReelVideoUrl(uploadedPublicId);
  }

  if (!url) {
    throw new Error("Cloudinary did not return a secure media URL.");
  }

  const generatedThumbnailUrl =
    resourceType === "video"
      ? createReelThumbnailUrl(uploadedPublicId, result.version)
      : null;

  return {
    mediaKind: kind,
    mediaType: getMediaType(kind),
    resourceType,
    url,
    publicId: uploadedPublicId,
    format: result.format || null,
    width:
      typeof result.width === "number"
        ? result.width
        : null,
    height:
      typeof result.height === "number"
        ? result.height
        : null,
    duration:
      typeof result.duration === "number"
        ? result.duration
        : null,
    bytes:
      typeof result.bytes === "number"
        ? result.bytes
        : null,
    originalFilename: file.name,
    thumbnailUrl: generatedThumbnailUrl,
  };
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized upload.",
      },
      {
        status: 401,
      }
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Failed to read Cloudinary upload request:", error);

    return NextResponse.json(
      {
        success: false,
        message: "The upload request could not be read.",
      },
      {
        status: 400,
      }
    );
  }

  const kind = getUploadKind(formData);

  if (!kind) {
    return NextResponse.json(
      {
        success: false,
        message:
          "A valid media kind is required: reel-video, thumbnail, gallery-image or gallery-video.",
      },
      {
        status: 400,
      }
    );
  }

  const files = collectFiles(formData);

  if (files.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Select at least one file to upload.",
      },
      {
        status: 400,
      }
    );
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      {
        success: false,
        message: `A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded at once.`,
      },
      {
        status: 400,
      }
    );
  }

  if (
    (kind === "reel-video" || kind === "thumbnail") &&
    files.length !== 1
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          kind === "reel-video"
            ? "Only one main reel video can be uploaded at a time."
            : "Only one thumbnail can be uploaded at a time.",
      },
      {
        status: 400,
      }
    );
  }

  for (const file of files) {
    const validationMessage = validateFile(file, kind);

    if (validationMessage) {
      return NextResponse.json(
        {
          success: false,
          message: validationMessage,
        },
        {
          status: 400,
        }
      );
    }
  }

  try {
    const assets: UploadedAsset[] = [];

    /*
     * Upload sequentially instead of sending many large media files to
     * Cloudinary simultaneously. This keeps server memory and network usage
     * more predictable.
     */
    for (const file of files) {
      const asset = await uploadFile(file, kind);
      assets.push(asset);
    }

    return NextResponse.json({
      success: true,
      message:
        assets.length === 1
          ? "Media uploaded successfully."
          : `${assets.length} media files uploaded successfully.`,
      asset: assets.length === 1 ? assets[0] : null,
      assets,
    });
  } catch (error) {
    console.error("Cloudinary media upload failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The media could not be uploaded.",
      },
      {
        status: 500,
      }
    );
  }
}