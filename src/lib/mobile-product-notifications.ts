import { NEW_PRODUCTS_TOPIC, sendMobileTopicPush } from "@/lib/mobile-push";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site-config";

const SEND_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_BODY_LENGTH = 220;

type PublishResult =
  | {
      ok: true;
      status: "SENT" | "ALREADY_SENT" | "IN_PROGRESS" | "NOT_PUBLIC";
      notificationId?: string;
      messageId?: string;
    }
  | {
      ok: false;
      status: "FAILED" | "NOT_FOUND";
      notificationId?: string;
      error: string;
    };

function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function buildProductUrl(reelProductId: string) {
  return new URL(
    `/product/${encodeURIComponent(reelProductId)}`,
    siteConfig.url
  ).toString();
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 2_000);
  }

  return "Unknown Firebase Cloud Messaging error.";
}

async function loadPublicReelProduct(reelProductId: string) {
  return prisma.reelProduct.findFirst({
    where: {
      id: reelProductId,
      status: true,
      product: {
        status: true,
      },
      category: {
        status: true,
        source: {
          status: true,
        },
        page: {
          status: true,
        },
      },
    },
    select: {
      id: true,
      title: true,
      caption: true,
      thumbnailUrl: true,
      product: {
        select: {
          id: true,
          name: true,
        },
      },
      gallery: {
        where: {
          mediaType: "IMAGE",
        },
        orderBy: [
          { isPrimary: "desc" },
          { displayOrder: "asc" },
          { createdAt: "asc" },
        ],
        take: 1,
        select: {
          url: true,
        },
      },
    },
  });
}

async function createOrRefreshNotification(input: {
  reelProductId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  deeplink: string;
}) {
  const existing = await prisma.mobileNotification.findUnique({
    where: {
      type_reelProductId: {
        type: "NEW_PRODUCT",
        reelProductId: input.reelProductId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "SENT") {
    return {
      ...existing,
      alreadySent: true as const,
    };
  }

  if (existing) {
    const updated = await prisma.mobileNotification.update({
      where: {
        id: existing.id,
      },
      data: {
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        deeplink: input.deeplink,
        topic: NEW_PRODUCTS_TOPIC,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      ...updated,
      alreadySent: false as const,
    };
  }

  try {
    const created = await prisma.mobileNotification.create({
      data: {
        type: "NEW_PRODUCT",
        status: "PENDING",
        reelProductId: input.reelProductId,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        deeplink: input.deeplink,
        topic: NEW_PRODUCTS_TOPIC,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      ...created,
      alreadySent: false as const,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const raced = await prisma.mobileNotification.findUnique({
        where: {
          type_reelProductId: {
            type: "NEW_PRODUCT",
            reelProductId: input.reelProductId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (raced) {
        return {
          ...raced,
          alreadySent: raced.status === "SENT",
        };
      }
    }

    throw error;
  }
}

async function claimNotificationForSend(notificationId: string) {
  const staleBefore = new Date(Date.now() - SEND_CLAIM_TIMEOUT_MS);

  const result = await prisma.mobileNotification.updateMany({
    where: {
      id: notificationId,
      status: {
        in: ["PENDING", "FAILED"],
      },
      OR: [
        {
          lastAttemptAt: null,
        },
        {
          lastAttemptAt: {
            lt: staleBefore,
          },
        },
      ],
    },
    data: {
      status: "PENDING",
      attempts: {
        increment: 1,
      },
      lastAttemptAt: new Date(),
      errorMessage: null,
    },
  });

  return result.count === 1;
}

export async function publishNewProductNotification(
  reelProductId: string
): Promise<PublishResult> {
  const id = reelProductId.trim();

  if (!id) {
    return {
      ok: false,
      status: "NOT_FOUND",
      error: "Reel product ID is required.",
    };
  }

  const reelProduct = await loadPublicReelProduct(id);

  if (!reelProduct) {
    const exists = await prisma.reelProduct.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!exists) {
      return {
        ok: false,
        status: "NOT_FOUND",
        error: "Reel product was not found.",
      };
    }

    return {
      ok: true,
      status: "NOT_PUBLIC",
    };
  }

  const productName = cleanText(
    reelProduct.product.name || reelProduct.title
  );
  const caption = cleanText(reelProduct.caption);
  const deeplink = buildProductUrl(reelProduct.id);
  const imageUrl =
    reelProduct.thumbnailUrl?.trim() ||
    reelProduct.gallery[0]?.url?.trim() ||
    null;
  const title = truncate(`New: ${productName}`, 120);
  const body = truncate(
    caption || `Shop ${productName} now on ${siteConfig.name}.`,
    MAX_BODY_LENGTH
  );

  const notification = await createOrRefreshNotification({
    reelProductId: reelProduct.id,
    title,
    body,
    imageUrl,
    deeplink,
  });

  if (notification.alreadySent) {
    return {
      ok: true,
      status: "ALREADY_SENT",
      notificationId: notification.id,
    };
  }

  const claimed = await claimNotificationForSend(notification.id);

  if (!claimed) {
    return {
      ok: true,
      status: "IN_PROGRESS",
      notificationId: notification.id,
    };
  }

  try {
    const sent = await sendMobileTopicPush({
      topic: NEW_PRODUCTS_TOPIC,
      title,
      body,
      deeplink,
      imageUrl,
      data: {
        type: "NEW_PRODUCT",
        notificationId: notification.id,
        reelProductId: reelProduct.id,
        productId: reelProduct.product.id,
      },
    });

    await prisma.mobileNotification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: sent.messageId,
        errorMessage: null,
      },
    });

    return {
      ok: true,
      status: "SENT",
      notificationId: notification.id,
      messageId: sent.messageId,
    };
  } catch (error) {
    const message = errorMessage(error);

    await prisma.mobileNotification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    console.error(
      `Failed to send NEW_PRODUCT push for reel product ${reelProduct.id}:`,
      error
    );

    return {
      ok: false,
      status: "FAILED",
      notificationId: notification.id,
      error: message,
    };
  }
}
