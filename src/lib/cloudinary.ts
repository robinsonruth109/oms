import { v2 as cloudinary } from "cloudinary";
import type {
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";

const DEFAULT_REEL_FOLDER = "oms/reel-products";

let isConfigured = false;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getCloudinary() {
  if (!isConfigured) {
    cloudinary.config({
      cloud_name: requiredEnvironmentVariable("CLOUDINARY_CLOUD_NAME"),
      api_key: requiredEnvironmentVariable("CLOUDINARY_API_KEY"),
      api_secret: requiredEnvironmentVariable("CLOUDINARY_API_SECRET"),
      secure: true,
    });

    isConfigured = true;
  }

  return cloudinary;
}

export function getReelFolder(): string {
  const configuredFolder = process.env.CLOUDINARY_REEL_FOLDER?.trim();

  return configuredFolder || DEFAULT_REEL_FOLDER;
}

export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  const client = getCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary returned an empty upload response."));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

export async function deleteCloudinaryAsset(input: {
  publicId: string;
  resourceType: "image" | "video";
}) {
  const client = getCloudinary();

  return client.uploader.destroy(input.publicId, {
    resource_type: input.resourceType,
    type: "upload",
    invalidate: true,
  });
}

export function isReelCloudinaryPublicId(publicId: string): boolean {
  const folder = getReelFolder().replace(/^\/+|\/+$/g, "");

  return (
    publicId === folder ||
    publicId.startsWith(`${folder}/`)
  );
}

export function createOptimisedReelVideoUrl(publicId: string): string {
  const client = getCloudinary();

  return client.url(publicId, {
    secure: true,
    resource_type: "video",
    type: "upload",
    transformation: [
      {
        width: 1080,
        height: 1920,
        crop: "limit",
      },
      {
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });
}

export function createReelThumbnailUrl(
  publicId: string,
  version?: number
): string {
  const client = getCloudinary();

  return client.url(publicId, {
    secure: true,
    resource_type: "video",
    type: "upload",
    version,
    format: "jpg",
    transformation: [
      {
        start_offset: "0",
      },
      {
        width: 720,
        height: 1280,
        crop: "fill",
        gravity: "auto",
      },
      {
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });
}