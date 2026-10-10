import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  createProductMediaObjectKey,
  createProductMediaUploadUrl,
} from "@/lib/product-media-storage";

export const dynamic = "force-dynamic";

const IMAGE_MAX = 12 * 1024 * 1024;
const VIDEO_MAX = 60 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      originalFileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    };

    const productId = String(body.productId || "").trim();
    const originalFileName = String(body.originalFileName || "").trim();
    const mimeType = String(body.mimeType || "").trim().toLowerCase();
    const sizeBytes = Number(body.sizeBytes || 0);

    if (!productId || !originalFileName || !mimeType || !Number.isFinite(sizeBytes)) {
      return NextResponse.json(
        { success: false, message: "Product, file name, MIME type and file size are required." },
        { status: 400 }
      );
    }

    const kind = mimeType.startsWith("image/")
      ? "IMAGE"
      : mimeType.startsWith("video/")
        ? "VIDEO"
        : null;

    if (!kind) {
      return NextResponse.json(
        { success: false, message: "Only image and video files are supported." },
        { status: 415 }
      );
    }

    const max = kind === "IMAGE" ? IMAGE_MAX : VIDEO_MAX;
    if (sizeBytes <= 0 || sizeBytes > max) {
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
    const uploadUrl = createProductMediaUploadUrl(objectKey);

    return NextResponse.json({
      success: true,
      kind,
      objectKey,
      uploadUrl,
      expiresIn: 900,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not prepare media upload.",
      },
      { status: 500 }
    );
  }
}
