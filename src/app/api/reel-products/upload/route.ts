import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

type UploadKind =
  | "video"
  | "thumbnail"
  | "gallery-image"
  | "gallery-video"
  | "collection-video";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

function readUploadKind(
  value: FormDataEntryValue | null
): UploadKind | null {
  if (
    value === "video" ||
    value === "thumbnail" ||
    value === "gallery-image" ||
    value === "gallery-video" ||
    value === "collection-video"
  ) {
    return value;
  }

  return null;
}

function sanitiseOriginalFilename(
  filename: string
): string {
  const withoutExtension = filename.replace(
    /\.[^/.]+$/,
    ""
  );

  const sanitised = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return sanitised || "reel-media";
}

function isVideoUploadKind(
  uploadKind: UploadKind
): boolean {
  return (
    uploadKind === "video" ||
    uploadKind === "gallery-video" ||
    uploadKind === "collection-video"
  );
}

function isImageUploadKind(
  uploadKind: UploadKind
): boolean {
  return (
    uploadKind === "thumbnail" ||
    uploadKind === "gallery-image"
  );
}

function getUploadFolder(
  rootFolder: string,
  uploadKind: UploadKind
): string {
  switch (uploadKind) {
    case "video":
      return `${rootFolder}/videos`;

    case "thumbnail":
      return `${rootFolder}/thumbnails`;

    case "gallery-image":
      return `${rootFolder}/gallery/images`;

    case "gallery-video":
      return `${rootFolder}/gallery/videos`;

    case "collection-video":
      return `${rootFolder}/collections`;

    default:
      return rootFolder;
  }
}

function getUploadTags(
  uploadKind: UploadKind,
  userId: string
): string[] {
  const tags = [
    "oms",
    "reel-product",
    `uploaded-by-${userId}`,
  ];

  switch (uploadKind) {
    case "video":
      tags.push("main-reel-video");
      break;

    case "thumbnail":
      tags.push("reel-thumbnail");
      break;

    case "gallery-image":
      tags.push("reel-gallery-image");
      break;

    case "gallery-video":
      tags.push("reel-gallery-video");
      break;

    case "collection-video":
      tags.push("reel-collection-video");
      break;
  }

  return tags;
}

async function requireAdmin() {
  const { authOptions } = await import(
    "@/lib/auth"
  );

  const session = await getServerSession(
    authOptions
  );

  if (
    !session?.user ||
    session.user.role !== "ADMIN"
  ) {
    return null;
  }

  return session;
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return jsonError(
        "You are not authorised to upload reel media.",
        401
      );
    }

    const formData = await request.formData();

    const fileEntry = formData.get("file");
    const uploadKind = readUploadKind(
      formData.get("kind")
    );

    if (!uploadKind) {
      return jsonError(
        'Upload kind must be "video", "thumbnail", "gallery-image", "gallery-video" or "collection-video".',
        400
      );
    }

    if (!(fileEntry instanceof File)) {
      return jsonError(
        "A media file is required.",
        400
      );
    }

    if (fileEntry.size <= 0) {
      return jsonError(
        "The selected file is empty.",
        400
      );
    }

    if (isVideoUploadKind(uploadKind)) {
      if (
        !ALLOWED_VIDEO_TYPES.has(fileEntry.type)
      ) {
        return jsonError(
          "Unsupported video type. Use MP4, WebM, MOV or M4V.",
          415
        );
      }

      if (
        fileEntry.size > MAX_VIDEO_SIZE_BYTES
      ) {
        return jsonError(
          "The video must not be larger than 100 MB.",
          413
        );
      }
    }

    if (isImageUploadKind(uploadKind)) {
      if (
        !ALLOWED_IMAGE_TYPES.has(fileEntry.type)
      ) {
        return jsonError(
          "Unsupported image type. Use JPG, PNG, WebP or AVIF.",
          415
        );
      }

      if (
        fileEntry.size > MAX_IMAGE_SIZE_BYTES
      ) {
        return jsonError(
          "The image must not be larger than 10 MB.",
          413
        );
      }
    }

    const fileBuffer = Buffer.from(
      await fileEntry.arrayBuffer()
    );

    const {
      createOptimisedReelVideoUrl,
      createReelThumbnailUrl,
      getReelFolder,
      uploadBufferToCloudinary,
    } = await import("@/lib/cloudinary");

    const rootFolder = getReelFolder();

    const uploadFolder = getUploadFolder(
      rootFolder,
      uploadKind
    );

    const originalName =
      sanitiseOriginalFilename(
        fileEntry.name
      );

    const uniqueSuffix = crypto.randomUUID();

    const userId = String(session.user.id);

    const commonContext = {
      uploaded_by_user_id: userId,
      original_filename: fileEntry.name,
      upload_kind: uploadKind,
    };

    if (isVideoUploadKind(uploadKind)) {
      const upload =
        await uploadBufferToCloudinary(
          fileBuffer,
          {
            resource_type: "video",
            folder: uploadFolder,
            public_id: `${originalName}-${uniqueSuffix}`,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            type: "upload",
            tags: getUploadTags(
              uploadKind,
              userId
            ),
            context: commonContext,
          }
        );

      const publicId = upload.public_id;

      const videoUrl =
        createOptimisedReelVideoUrl(
          publicId,
          upload.version
        );

      const thumbnailUrl =
        createReelThumbnailUrl(
          publicId,
          upload.version
        );

      const isMainVideo = uploadKind === "video";
      const isCollectionVideo = uploadKind === "collection-video";

      return NextResponse.json({
        success: true,
        message: isMainVideo
          ? "Reel video uploaded successfully."
          : isCollectionVideo
            ? "Collection hero video uploaded successfully."
            : "Gallery video uploaded successfully.",
        media: {
          kind: uploadKind,
          publicId,
          originalUrl: upload.secure_url,
          url: videoUrl,
          thumbnailUrl,
          version: upload.version,
          format: upload.format || null,
          resourceType:
            upload.resource_type || "video",
          bytes:
            typeof upload.bytes === "number"
              ? upload.bytes
              : fileEntry.size,
          width:
            typeof upload.width === "number"
              ? upload.width
              : null,
          height:
            typeof upload.height === "number"
              ? upload.height
              : null,
          duration:
            typeof upload.duration === "number"
              ? upload.duration
              : null,
          createdAt:
            upload.created_at || null,
        },
      });
    }

    const isThumbnail =
      uploadKind === "thumbnail";

    const upload =
      await uploadBufferToCloudinary(
        fileBuffer,
        {
          resource_type: "image",
          folder: uploadFolder,
          public_id: `${originalName}-${uniqueSuffix}`,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
          type: "upload",
          transformation: isThumbnail
            ? [
                {
                  width: 720,
                  height: 1280,
                  crop: "fill",
                  gravity: "auto",
                  quality: "auto",
                },
              ]
            : [
                {
                  width: 1600,
                  height: 1600,
                  crop: "limit",
                  quality: "auto",
                },
              ],
          tags: getUploadTags(
            uploadKind,
            userId
          ),
          context: commonContext,
        }
      );

    return NextResponse.json({
      success: true,
      message: isThumbnail
        ? "Reel thumbnail uploaded successfully."
        : "Gallery image uploaded successfully.",
      media: {
        kind: uploadKind,
        publicId: upload.public_id,
        originalUrl: upload.secure_url,
        url: upload.secure_url,
        thumbnailUrl: null,
        version: upload.version,
        format: upload.format || null,
        resourceType:
          upload.resource_type || "image",
        bytes:
          typeof upload.bytes === "number"
            ? upload.bytes
            : fileEntry.size,
        width:
          typeof upload.width === "number"
            ? upload.width
            : null,
        height:
          typeof upload.height === "number"
            ? upload.height
            : null,
        duration: null,
        createdAt:
          upload.created_at || null,
      },
    });
  } catch (error) {
    console.error(
      "Reel media upload failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected upload error occurred.";

    if (
      message.includes(
        "CLOUDINARY_CLOUD_NAME"
      ) ||
      message.includes("CLOUDINARY_API_KEY") ||
      message.includes(
        "CLOUDINARY_API_SECRET"
      )
    ) {
      return jsonError(
        "Cloudinary has not been configured correctly.",
        500
      );
    }

    if (
      message.toLowerCase().includes(
        "file size"
      ) ||
      message.toLowerCase().includes(
        "too large"
      )
    ) {
      return jsonError(
        "The selected media file is too large.",
        413
      );
    }

    return jsonError(
      "The reel media upload failed.",
      500
    );
  }
}