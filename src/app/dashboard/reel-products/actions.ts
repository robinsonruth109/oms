"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { publishNewProductNotification } from "@/lib/mobile-product-notifications";
import { invalidateStorefrontFeedCache } from "@/lib/storefront";

export type ReelProductActionState = {
  success: boolean;
  message: string;
};

type ReelProductMediaInput = {
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
  videoDuration: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFormat: string | null;
  videoBytes: number | null;
};

type GalleryMediaType = "IMAGE" | "VIDEO";

type ReelGalleryInput = {
  id?: string;
  mediaType: GalleryMediaType;
  url: string;
  publicId: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bytes: number | null;
  altText: string | null;
  displayOrder: number;
};

type ExistingGalleryAsset = {
  id: string;
  publicId: string;
  resourceType: string;
};

const MAX_CAPTION_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 100_000;
const MAX_GALLERY_ITEMS = 12;

async function requireAdmin() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  return Boolean(session?.user?.role === "ADMIN");
}

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function readRequired(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function readOptionalNumber(
  formData: FormData,
  key: string
): number | null {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : null;
}

function readMedia(formData: FormData): ReelProductMediaInput {
  return {
    videoUrl: readRequired(formData, "videoUrl"),
    videoPublicId: readRequired(formData, "videoPublicId"),
    thumbnailUrl: readOptional(formData, "thumbnailUrl"),
    thumbnailPublicId: readOptional(
      formData,
      "thumbnailPublicId"
    ),
    videoDuration: readOptionalNumber(
      formData,
      "videoDuration"
    ),
    videoWidth: readOptionalNumber(formData, "videoWidth"),
    videoHeight: readOptionalNumber(formData, "videoHeight"),
    videoFormat: readOptional(formData, "videoFormat"),
    videoBytes: readOptionalNumber(formData, "videoBytes"),
  };
}

function normaliseCaption(value: string | null) {
  if (!value) {
    return null;
  }

  return value.slice(0, MAX_CAPTION_LENGTH);
}

function sanitiseDescriptionHtml(value: string | null) {
  if (!value) {
    return null;
  }

  const sanitised = value
    .slice(0, MAX_DESCRIPTION_LENGTH)
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base)[^>]*\/?\s*>/gi,
      ""
    )
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(
      /\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,
      ""
    )
    .trim();

  return sanitised || null;
}

function toNullableFiniteNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

function toNullableInteger(value: unknown) {
  const numberValue = toNullableFiniteNumber(value);

  if (numberValue === null) {
    return null;
  }

  return Number.isInteger(numberValue)
    ? numberValue
    : null;
}

function parseGallery(formData: FormData):
  | {
      success: true;
      gallery: ReelGalleryInput[];
    }
  | {
      success: false;
      message: string;
    } {
  const rawValue = String(
    formData.get("galleryJson") ?? "[]"
  ).trim();

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue || "[]");
  } catch {
    return {
      success: false,
      message: "Gallery data is invalid.",
    };
  }

  if (!Array.isArray(parsedValue)) {
    return {
      success: false,
      message: "Gallery data must be a list.",
    };
  }

  if (parsedValue.length > MAX_GALLERY_ITEMS) {
    return {
      success: false,
      message: `A maximum of ${MAX_GALLERY_ITEMS} gallery items is allowed.`,
    };
  }

  const gallery: ReelGalleryInput[] = [];

  for (const [index, rawItem] of parsedValue.entries()) {
    if (
      !rawItem ||
      typeof rawItem !== "object" ||
      Array.isArray(rawItem)
    ) {
      return {
        success: false,
        message: `Gallery item ${index + 1} is invalid.`,
      };
    }

    const item = rawItem as Record<string, unknown>;

    const mediaType =
      item.mediaType === "IMAGE" ||
      item.mediaType === "VIDEO"
        ? item.mediaType
        : null;

    const url =
      typeof item.url === "string"
        ? item.url.trim()
        : "";

    const publicId =
      typeof item.publicId === "string"
        ? item.publicId.trim()
        : "";

    if (!mediaType || !url || !publicId) {
      return {
        success: false,
        message: `Gallery item ${index + 1} is incomplete.`,
      };
    }

    const id =
      typeof item.id === "string" &&
      item.id.trim()
        ? item.id.trim()
        : undefined;

    const resourceType =
      typeof item.resourceType === "string" &&
      item.resourceType.trim()
        ? item.resourceType.trim()
        : mediaType === "IMAGE"
          ? "image"
          : "video";

    const format =
      typeof item.format === "string" &&
      item.format.trim()
        ? item.format.trim()
        : null;

    const altText =
      typeof item.altText === "string" &&
      item.altText.trim()
        ? item.altText.trim().slice(0, 500)
        : null;

    gallery.push({
      id,
      mediaType,
      url,
      publicId,
      resourceType,
      format,
      width: toNullableInteger(item.width),
      height: toNullableInteger(item.height),
      duration: toNullableFiniteNumber(item.duration),
      bytes: toNullableInteger(item.bytes),
      altText,
      displayOrder: index,
    });
  }

  const publicIds = gallery.map((item) => item.publicId);

  if (new Set(publicIds).size !== publicIds.length) {
    return {
      success: false,
      message: "The same gallery asset cannot be added twice.",
    };
  }

  return {
    success: true,
    gallery,
  };
}

function refreshReelProductPages() {
  invalidateStorefrontFeedCache();
  revalidatePath("/");
  revalidatePath("/dashboard/reel-products");
  revalidatePath("/reels");
  revalidatePath("/seller/reels");
}

async function safelyPublishNewProductNotification(
  reelProductId: string
) {
  try {
    return await publishNewProductNotification(reelProductId);
  } catch (error) {
    console.error(
      `Unexpected mobile notification failure for reel product ${reelProductId}:`,
      error
    );

    return {
      ok: false as const,
      status: "FAILED" as const,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected mobile notification failure.",
    };
  }
}

async function safelyDeleteCloudinaryAsset(input: {
  publicId: string | null | undefined;
  resourceType: "image" | "video";
}) {
  const publicId = input.publicId?.trim();

  if (!publicId) {
    return;
  }

  try {
    const {
      deleteCloudinaryAsset,
      isReelCloudinaryPublicId,
    } = await import("@/lib/cloudinary");

    if (!isReelCloudinaryPublicId(publicId)) {
      console.warn(
        `Skipped Cloudinary deletion outside the Reel Products folder: ${publicId}`
      );
      return;
    }

    const result = await deleteCloudinaryAsset({
      publicId,
      resourceType: input.resourceType,
    });

    if (
      result.result !== "ok" &&
      result.result !== "not found"
    ) {
      console.error(
        "Unexpected Cloudinary deletion response:",
        result
      );
    }
  } catch (error) {
    console.error(
      `Failed to delete Cloudinary ${input.resourceType} asset:`,
      error
    );
  }
}

function asCloudinaryResourceType(
  value: string
): "image" | "video" {
  return value.toLowerCase() === "video"
    ? "video"
    : "image";
}

async function deleteCloudinaryAssets(
  assets: ExistingGalleryAsset[]
) {
  await Promise.all(
    assets.map((asset) =>
      safelyDeleteCloudinaryAsset({
        publicId: asset.publicId,
        resourceType: asCloudinaryResourceType(
          asset.resourceType
        ),
      })
    )
  );
}

async function validateProductAndCategory(
  productId: string,
  categoryId: string
) {
  const prisma = await getPrisma();

  const [product, category] = await Promise.all([
    prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.reelCategory.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!product) {
    return {
      success: false as const,
      message: "Selected product was not found.",
    };
  }

  if (!category) {
    return {
      success: false as const,
      message: "Selected reel category was not found.",
    };
  }

  return {
    success: true as const,
    product,
  };
}

export async function createReelProduct(
  formData: FormData
): Promise<ReelProductActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const productId = readRequired(formData, "productId");
  const categoryId = readRequired(formData, "categoryId");
  const caption = normaliseCaption(
    readOptional(formData, "caption")
  );
  const descriptionHtml = sanitiseDescriptionHtml(
    readOptional(formData, "descriptionHtml")
  );
  const status = formData.get("status") === "true";
  const media = readMedia(formData);
  const galleryResult = parseGallery(formData);

  if (!productId || !categoryId) {
    return {
      success: false,
      message: "Product and reel category are required.",
    };
  }

  if (!media.videoUrl || !media.videoPublicId) {
    return {
      success: false,
      message: "A reel video must be uploaded before saving.",
    };
  }

  if (!galleryResult.success) {
    return {
      success: false,
      message: galleryResult.message,
    };
  }

  const validation = await validateProductAndCategory(
    productId,
    categoryId
  );

  if (!validation.success) {
    return validation;
  }

  const prisma = await getPrisma();

  const duplicate = await prisma.reelProduct.findFirst({
    where: {
      productId,
      categoryId,
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    return {
      success: false,
      message:
        "This product is already connected to the selected reel category.",
    };
  }

  try {
    const createdReelProduct = await prisma.$transaction(
      async (transaction) => {
        const aggregate = await transaction.reelProduct.aggregate({
          _max: {
            displayOrder: true,
          },
        });

        const nextDisplayOrder =
          (aggregate._max.displayOrder ?? -1) + 1;

        return transaction.reelProduct.create({
          data: {
            productId,
            categoryId,
            title: validation.product.name,
            caption,
            descriptionHtml,
            displayOrder: nextDisplayOrder,
            status,
            videoUrl: media.videoUrl,
            videoPublicId: media.videoPublicId,
            thumbnailUrl: media.thumbnailUrl,
            thumbnailPublicId: media.thumbnailPublicId,
            videoDuration: media.videoDuration,
            videoWidth: media.videoWidth,
            videoHeight: media.videoHeight,
            videoFormat: media.videoFormat,
            videoBytes: media.videoBytes,
            gallery: {
              create: galleryResult.gallery.map((item) => ({
                mediaType: item.mediaType,
                url: item.url,
                publicId: item.publicId,
                resourceType: item.resourceType,
                format: item.format,
                width: item.width,
                height: item.height,
                duration: item.duration,
                bytes: item.bytes,
                altText: item.altText,
                displayOrder: item.displayOrder,
                isPrimary: item.displayOrder === 0,
              })),
            },
          },
          select: {
            id: true,
          },
        });
      }
    );

    let notificationWarning = "";

    if (status) {
      const notificationResult =
        await safelyPublishNewProductNotification(createdReelProduct.id);

      if (!notificationResult.ok) {
        notificationWarning =
          " Product was saved, but its mobile push notification could not be sent.";
      }
    }

    refreshReelProductPages();

    return {
      success: true,
      message: `Reel product created successfully.${notificationWarning}`,
    };
  } catch (error) {
    console.error("Failed to create reel product:", error);

    return {
      success: false,
      message: "The reel product could not be created.",
    };
  }
}

export async function updateReelProduct(
  formData: FormData
): Promise<ReelProductActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = readRequired(formData, "id");
  const productId = readRequired(formData, "productId");
  const categoryId = readRequired(formData, "categoryId");
  const caption = normaliseCaption(
    readOptional(formData, "caption")
  );
  const descriptionHtml = sanitiseDescriptionHtml(
    readOptional(formData, "descriptionHtml")
  );
  const status = formData.get("status") === "true";
  const media = readMedia(formData);
  const galleryResult = parseGallery(formData);

  if (!id || !productId || !categoryId) {
    return {
      success: false,
      message: "All required reel product fields must be completed.",
    };
  }

  if (!media.videoUrl || !media.videoPublicId) {
    return {
      success: false,
      message: "A reel video is required.",
    };
  }

  if (!galleryResult.success) {
    return {
      success: false,
      message: galleryResult.message,
    };
  }

  const validation = await validateProductAndCategory(
    productId,
    categoryId
  );

  if (!validation.success) {
    return validation;
  }

  const prisma = await getPrisma();

  const [existingReelProduct, duplicate] = await Promise.all([
    prisma.reelProduct.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        status: true,
        videoPublicId: true,
        thumbnailPublicId: true,
        gallery: {
          select: {
            id: true,
            publicId: true,
            resourceType: true,
          },
        },
      },
    }),
    prisma.reelProduct.findFirst({
      where: {
        productId,
        categoryId,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!existingReelProduct) {
    return {
      success: false,
      message: "Reel product was not found.",
    };
  }

  if (duplicate) {
    return {
      success: false,
      message:
        "This product is already connected to the selected reel category.",
    };
  }

  const existingGalleryById = new Map(
    existingReelProduct.gallery.map((item) => [
      item.id,
      item,
    ])
  );

  for (const item of galleryResult.gallery) {
    if (
      item.id &&
      !existingGalleryById.has(item.id)
    ) {
      return {
        success: false,
        message:
          "One or more gallery items do not belong to this reel product.",
      };
    }
  }

  const retainedGalleryIds = new Set(
    galleryResult.gallery
      .map((item) => item.id)
      .filter((item): item is string => Boolean(item))
  );

  const removedGalleryAssets =
    existingReelProduct.gallery.filter(
      (item) => !retainedGalleryIds.has(item.id)
    );

  const previousVideoPublicId =
    existingReelProduct.videoPublicId;
  const previousThumbnailPublicId =
    existingReelProduct.thumbnailPublicId;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.reelProduct.update({
        where: {
          id,
        },
        data: {
          productId,
          categoryId,
          title: validation.product.name,
          caption,
          descriptionHtml,
          status,
          videoUrl: media.videoUrl,
          videoPublicId: media.videoPublicId,
          thumbnailUrl: media.thumbnailUrl,
          thumbnailPublicId: media.thumbnailPublicId,
          videoDuration: media.videoDuration,
          videoWidth: media.videoWidth,
          videoHeight: media.videoHeight,
          videoFormat: media.videoFormat,
          videoBytes: media.videoBytes,
        },
      });

      if (removedGalleryAssets.length) {
        await transaction.reelProductMedia.deleteMany({
          where: {
            reelProductId: id,
            id: {
              in: removedGalleryAssets.map(
                (item) => item.id
              ),
            },
          },
        });
      }

      for (const item of galleryResult.gallery) {
        if (item.id) {
          await transaction.reelProductMedia.update({
            where: {
              id: item.id,
            },
            data: {
              mediaType: item.mediaType,
              url: item.url,
              publicId: item.publicId,
              resourceType: item.resourceType,
              format: item.format,
              width: item.width,
              height: item.height,
              duration: item.duration,
              bytes: item.bytes,
              altText: item.altText,
              displayOrder: item.displayOrder,
              isPrimary: item.displayOrder === 0,
            },
          });
        } else {
          await transaction.reelProductMedia.create({
            data: {
              reelProductId: id,
              mediaType: item.mediaType,
              url: item.url,
              publicId: item.publicId,
              resourceType: item.resourceType,
              format: item.format,
              width: item.width,
              height: item.height,
              duration: item.duration,
              bytes: item.bytes,
              altText: item.altText,
              displayOrder: item.displayOrder,
              isPrimary: item.displayOrder === 0,
            },
          });
        }
      }
    });
  } catch (error) {
    console.error("Failed to update reel product:", error);

    return {
      success: false,
      message: "The reel product could not be updated.",
    };
  }

  if (
    previousVideoPublicId &&
    previousVideoPublicId !== media.videoPublicId
  ) {
    await safelyDeleteCloudinaryAsset({
      publicId: previousVideoPublicId,
      resourceType: "video",
    });
  }

  if (
    previousThumbnailPublicId &&
    previousThumbnailPublicId !==
      media.thumbnailPublicId &&
    previousThumbnailPublicId !== previousVideoPublicId
  ) {
    await safelyDeleteCloudinaryAsset({
      publicId: previousThumbnailPublicId,
      resourceType: "image",
    });
  }

  await deleteCloudinaryAssets(removedGalleryAssets);

  let notificationWarning = "";

  if (status && !existingReelProduct.status) {
    const notificationResult = await safelyPublishNewProductNotification(id);

    if (!notificationResult.ok) {
      notificationWarning =
        " Product was activated, but its mobile push notification could not be sent.";
    }
  }

  refreshReelProductPages();

  return {
    success: true,
    message: `Reel product updated successfully.${notificationWarning}`,
  };
}

export async function toggleReelProduct(
  id: string,
  status: boolean
): Promise<ReelProductActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const reelProductId = id.trim();

  if (!reelProductId) {
    return {
      success: false,
      message: "Reel product ID is required.",
    };
  }

  const prisma = await getPrisma();

  const reelProduct = await prisma.reelProduct.findUnique({
    where: {
      id: reelProductId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!reelProduct) {
    return {
      success: false,
      message: "Reel product was not found.",
    };
  }

  try {
    await prisma.reelProduct.update({
      where: {
        id: reelProductId,
      },
      data: {
        status,
      },
    });

    let notificationWarning = "";

    if (status && !reelProduct.status) {
      const notificationResult =
        await safelyPublishNewProductNotification(reelProductId);

      if (!notificationResult.ok) {
        notificationWarning =
          " Product was activated, but its mobile push notification could not be sent.";
      }
    }

    refreshReelProductPages();

    return {
      success: true,
      message: status
        ? `Reel product activated.${notificationWarning}`
        : "Reel product deactivated.",
    };
  } catch (error) {
    console.error("Failed to toggle reel product:", error);

    return {
      success: false,
      message:
        "The reel product status could not be changed.",
    };
  }
}

export async function deleteReelProduct(
  id: string
): Promise<ReelProductActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const reelProductId = id.trim();

  if (!reelProductId) {
    return {
      success: false,
      message: "Reel product ID is required.",
    };
  }

  const prisma = await getPrisma();

  const reelProduct = await prisma.reelProduct.findUnique({
    where: {
      id: reelProductId,
    },
    select: {
      id: true,
      displayOrder: true,
      videoPublicId: true,
      thumbnailPublicId: true,
      gallery: {
        select: {
          id: true,
          publicId: true,
          resourceType: true,
        },
      },
    },
  });

  if (!reelProduct) {
    return {
      success: false,
      message: "Reel product was not found.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.reelProduct.delete({
        where: {
          id: reelProductId,
        },
      });

      await transaction.reelProduct.updateMany({
        where: {
          displayOrder: {
            gt: reelProduct.displayOrder,
          },
        },
        data: {
          displayOrder: {
            decrement: 1,
          },
        },
      });
    });
  } catch (error) {
    console.error("Failed to delete reel product:", error);

    return {
      success: false,
      message: "The reel product could not be deleted.",
    };
  }

  await Promise.all([
    safelyDeleteCloudinaryAsset({
      publicId: reelProduct.videoPublicId,
      resourceType: "video",
    }),
    reelProduct.thumbnailPublicId &&
    reelProduct.thumbnailPublicId !==
      reelProduct.videoPublicId
      ? safelyDeleteCloudinaryAsset({
          publicId: reelProduct.thumbnailPublicId,
          resourceType: "image",
        })
      : Promise.resolve(),
    deleteCloudinaryAssets(reelProduct.gallery),
  ]);

  refreshReelProductPages();

  return {
    success: true,
    message: "Reel product deleted successfully.",
  };
}