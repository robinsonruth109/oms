import "server-only";

import crypto from "node:crypto";

type StorageConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  urlStyle: "path" | "virtual-host";
};

function config(): StorageConfig {
  const endpoint = String(process.env.PRODUCT_MEDIA_S3_ENDPOINT || "").trim();
  const bucket = String(process.env.PRODUCT_MEDIA_S3_BUCKET || "").trim();
  const region = String(process.env.PRODUCT_MEDIA_S3_REGION || "").trim();
  const accessKeyId = String(
    process.env.PRODUCT_MEDIA_S3_ACCESS_KEY_ID || ""
  ).trim();
  const secretAccessKey = String(
    process.env.PRODUCT_MEDIA_S3_SECRET_ACCESS_KEY || ""
  ).trim();
  const urlStyle =
    String(process.env.PRODUCT_MEDIA_S3_URL_STYLE || "path").toLowerCase() ===
    "virtual-host"
      ? "virtual-host"
      : "path";

  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Railway product media bucket is not configured. Set PRODUCT_MEDIA_S3_ENDPOINT, PRODUCT_MEDIA_S3_BUCKET, PRODUCT_MEDIA_S3_REGION, PRODUCT_MEDIA_S3_ACCESS_KEY_ID and PRODUCT_MEDIA_S3_SECRET_ACCESS_KEY."
    );
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    urlStyle,
  };
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function awsEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) =>
      "%" + char.charCodeAt(0).toString(16).toUpperCase()
    );
}

function encodedPath(value: string) {
  return value
    .split("/")
    .map((part) => awsEncode(part))
    .join("/");
}

function amzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function shortDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function signingKey(secret: string, date: string, region: string) {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function buildTarget(cfg: StorageConfig, objectKey: string) {
  const endpoint = new URL(cfg.endpoint);
  const keyPath = encodedPath(objectKey.replace(/^\/+/, ""));

  if (cfg.urlStyle === "virtual-host") {
    const host = cfg.bucket + "." + endpoint.host;
    const path = "/" + keyPath;
    return {
      host,
      path,
      protocol: endpoint.protocol,
    };
  }

  return {
    host: endpoint.host,
    path: "/" + awsEncode(cfg.bucket) + "/" + keyPath,
    protocol: endpoint.protocol,
  };
}

function presign(
  method: "GET" | "PUT" | "DELETE",
  objectKey: string,
  expiresSeconds: number
) {
  const cfg = config();
  const now = new Date();
  const amz = amzDate(now);
  const day = shortDate(now);
  const scope = day + "/" + cfg.region + "/s3/aws4_request";
  const target = buildTarget(cfg, objectKey);

  const params = new URLSearchParams();
  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential", cfg.accessKeyId + "/" + scope);
  params.set("X-Amz-Date", amz);
  params.set(
    "X-Amz-Expires",
    String(Math.max(1, Math.min(3600, Math.floor(expiresSeconds))))
  );
  params.set("X-Amz-SignedHeaders", "host");

  const canonicalQuery = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => awsEncode(key) + "=" + awsEncode(value))
    .join("&");

  const canonicalHeaders = "host:" + target.host + "\n";
  const canonicalRequest = [
    method,
    target.path,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(cfg.secretAccessKey, day, cfg.region))
    .update(stringToSign, "utf8")
    .digest("hex");

  return (
    target.protocol +
    "//" +
    target.host +
    target.path +
    "?" +
    canonicalQuery +
    "&X-Amz-Signature=" +
    signature
  );
}

export function productMediaStorageConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export function createProductMediaObjectKey(input: {
  productId: string;
  kind: "IMAGE" | "VIDEO";
  originalFileName: string;
}) {
  const extMatch = input.originalFileName.match(/(\.[a-zA-Z0-9]{1,10})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  const folder = input.kind === "VIDEO" ? "videos" : "images";
  return (
    "products/" +
    input.productId +
    "/" +
    folder +
    "/" +
    Date.now().toString(36) +
    "-" +
    crypto.randomBytes(10).toString("hex") +
    ext
  );
}

export function createProductMediaUploadUrl(
  objectKey: string,
  expiresSeconds = 900
) {
  return presign("PUT", objectKey, expiresSeconds);
}

export function createProductMediaDownloadUrl(
  objectKey: string,
  expiresSeconds = 1800
) {
  return presign("GET", objectKey, expiresSeconds);
}

export async function deleteProductMediaObject(objectKey: string) {
  const response = await fetch(presign("DELETE", objectKey, 300), {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(
      "Failed to delete Railway bucket object. HTTP " + response.status
    );
  }
}
