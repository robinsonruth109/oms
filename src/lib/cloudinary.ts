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

function encodeCloudinaryPublicId(publicId: string): string {
  return publicId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normaliseVersion(version?: number): string {
  if (
    version === undefined ||
    !Number.isInteger(version) ||
    version <= 0
  ) {
    return "";
  }

  return `/v${version}`;
}

function buildCloudinaryDeliveryUrl(input: {
  publicId: string;
  resourceType: "image" | "video";
  transformation: string;
  version?: number;
  extension?: string;
}): string {
  const cloudName = requiredEnvironmentVariable(
    "CLOUDINARY_CLOUD_NAME"
  );

  const encodedPublicId = encodeCloudinaryPublicId(
    input.publicId
  );

  const versionPath = normaliseVersion(input.version);

  const extension = input.extension
    ? `.${input.extension.replace(/^\./, "")}`
    : "";

  return (
    [
      "https://res.cloudinary.com",
      encodeURIComponent(cloudName),
      input.resourceType,
      "upload",
      input.transformation,
    ].join("/") +
    `${versionPath}/${encodedPublicId}${extension}`
  );
}

export function getCloudinary() {
  if (!isConfigured) {
    cloudinary.config({
      cloud_name: requiredEnvironmentVariable(
        "CLOUDINARY_CLOUD_NAME"
      ),
      api_key: requiredEnvironmentVariable(
        "CLOUDINARY_API_KEY"
      ),
      api_secret: requiredEnvironmentVariable(
        "CLOUDINARY_API_SECRET"
      ),
      secure: true,
    });

    isConfigured = true;
  }

  return cloudinary;
}

export function getReelFolder(): string {
  const configuredFolder =
    process.env.CLOUDINARY_REEL_FOLDER?.trim();

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
          reject(
            new Error(
              "Cloudinary returned an empty upload response."
            )
          );
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

export function isReelCloudinaryPublicId(
  publicId: string
): boolean {
  const folder = getReelFolder().replace(
    /^\/+|\/+$/g,
    ""
  );

  return (
    publicId === folder ||
    publicId.startsWith(`${folder}/`)
  );
}

export function createOptimisedReelVideoUrl(
  publicId: string,
  version?: number
): string {
  return buildCloudinaryDeliveryUrl({
    publicId,
    resourceType: "video",
    version,
    extension: "mp4",
    transformation:
      "c_limit,w_1080,h_1920,q_auto,f_auto",
  });
}

export function createReelThumbnailUrl(
  publicId: string,
  version?: number
): string {
  return buildCloudinaryDeliveryUrl({
    publicId,
    resourceType: "video",
    version,
    extension: "jpg",
    transformation:
      "so_0,c_fill,g_auto,w_720,h_1280,q_auto,f_auto",
  });
}