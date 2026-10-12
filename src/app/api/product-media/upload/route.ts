import crypto from "node:crypto";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { enqueueFullSyncForProduct } from "@/lib/product-catalog-sync";
import {
  createProductMediaObjectKey,
  deleteProductMediaObject,
  uploadProductMediaObject,
} from "@/lib/product-media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_MAX = 12 * 1024 * 1024;
const VIDEO_MAX = 60 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function decodeFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  let uploadedObjectKey: string | null = null;

  try {
    const productId = String(request.headers.get("x-product-id") || "").trim();
    const originalFileName = decodeFileName(
      String(request.headers.get("x-original-file-name") || "").trim()
    );
    const mimeType = String(
      request.headers.get("content-type") ||
        request.headers.get("x-mime-type") ||
        ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();
    const declaredSize = Number(request.headers.get("x-file-size") || 0);
    const checksum = String(request.headers.get("x-file-sha256") || "")
      .trim()
      .toLowerCase();
    const requestedPrimary =
      String(request.headers.get("x-media-primary") || "").toLowerCase() ===
      "true";

    if (
      !productId ||
      !originalFileName ||
      !mimeType ||
      !Number.isSafeInteger(declaredSize) ||
      declaredSize <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Product, file name, MIME type and file size are required.",
        },
        { status: 400 }
      );
    }

    const kind = IMAGE_TYPES.has(mimeType)
      ? "IMAGE"
      : VIDEO_TYPES.has(mimeType)
        ? "VIDEO"
        : null;

    if (!kind) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unsupported file type. Images: JPG/PNG/WebP/GIF. Videos: MP4/WebM/MOV.",
        },
        { status: 415 }
      );
    }

    const max = kind === "IMAGE" ? IMAGE_MAX : VIDEO_MAX;
    if (declaredSize > max) {
      return NextResponse.json(
        {
          success: false,
          message:
            kind === "IMAGE"
              ? "Image must be 12 MB or smaller."
              : "Video must be 60 MB or smaller.",
        },
        { status: 413 }
      );
    }

    if (checksum && !/^[a-f0-9]{64}$/.test(checksum)) {
      return NextResponse.json(
        { success: false, message: "Invalid file checksum." },
        { status: 400 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        { success: false, message: "Upload body is empty." },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const objectKey = createProductMediaObjectKey({
      productId,
      kind,
      originalFileName,
    });
    uploadedObjectKey = objectKey;

    await uploadProductMediaObject({
      objectKey,
      body: request.body,
      contentType: mimeType,
    });

    const currentCount = await prisma.productMedia.count({
      where: { productId, kind },
    });
    const isPrimary =
      kind === "IMAGE" && (requestedPrimary || currentCount === 0);

    const mediaId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.productMedia.updateMany({
          where: { productId, kind: "IMAGE", isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.productMedia.create({
        data: {
          id: mediaId,
          productId,
          kind,
          objectKey,
          originalFileName,
          mimeType,
          sizeBytes: BigInt(declaredSize),
          checksum: checksum || null,
          isPrimary,
          sortOrder: currentCount,
        },
      });

      await enqueueFullSyncForProduct(tx, productId);
    });

    return NextResponse.json({
      success: true,
      message: "Media uploaded and linked to Product Master.",
      mediaId,
    });
  } catch (error) {
    if (uploadedObjectKey) {
      try {
        await deleteProductMediaObject(uploadedObjectKey);
      } catch {
        // Best-effort cleanup only. Preserve the real upload/registration error.
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Product media upload failed.",
      },
      { status: 500 }
    );
  }
}
