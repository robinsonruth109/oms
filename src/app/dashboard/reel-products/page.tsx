import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ReelProductManager from "./reel-product-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export default async function ReelProductsPage() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const prisma = await getPrisma();

  const [products, categories, reelProducts] =
    await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          sellingPrice: true,
          status: true,
          parent: {
            select: {
              id: true,
              sku: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          {
            name: "asc",
          },
          {
            sku: "asc",
          },
        ],
      }),

      prisma.reelCategory.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          source: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          page: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.reelProduct.findMany({
        select: {
          id: true,
          productId: true,
          categoryId: true,
          title: true,
          caption: true,
          descriptionHtml: true,
          displayOrder: true,
          videoUrl: true,
          videoPublicId: true,
          thumbnailUrl: true,
          thumbnailPublicId: true,
          videoDuration: true,
          videoWidth: true,
          videoHeight: true,
          videoFormat: true,
          videoBytes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          gallery: {
            select: {
              id: true,
              reelProductId: true,
              mediaType: true,
              url: true,
              publicId: true,
              resourceType: true,
              format: true,
              width: true,
              height: true,
              duration: true,
              bytes: true,
              altText: true,
              displayOrder: true,
              isPrimary: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [
              {
                displayOrder: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
          },
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              sellingPrice: true,
              status: true,
              parent: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              status: true,
              source: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
              page: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      }),
    ]);

  const serialisedProducts = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    sellingPrice: Number(product.sellingPrice),
    status: product.status,
    parent: {
      id: product.parent.id,
      sku: product.parent.sku,
      name: product.parent.name,
      status: product.parent.status,
    },
  }));

  const serialisedCategories = categories.map(
    (category) => ({
      id: category.id,
      name: category.name,
      status: category.status,
      source: {
        id: category.source.id,
        name: category.source.name,
        status: category.source.status,
      },
      page: {
        id: category.page.id,
        name: category.page.name,
        status: category.page.status,
      },
    })
  );

  const serialisedReelProducts = reelProducts.map(
    (reelProduct) => ({
      id: reelProduct.id,
      productId: reelProduct.productId,
      categoryId: reelProduct.categoryId,
      title: reelProduct.title,
      caption: reelProduct.caption,
      descriptionHtml: reelProduct.descriptionHtml,
      displayOrder: reelProduct.displayOrder,
      videoUrl: reelProduct.videoUrl,
      videoPublicId: reelProduct.videoPublicId,
      thumbnailUrl: reelProduct.thumbnailUrl,
      thumbnailPublicId: reelProduct.thumbnailPublicId,
      videoDuration:
        reelProduct.videoDuration === null
          ? null
          : Number(reelProduct.videoDuration),
      videoWidth: reelProduct.videoWidth,
      videoHeight: reelProduct.videoHeight,
      videoFormat: reelProduct.videoFormat,
      videoBytes: reelProduct.videoBytes,
      status: reelProduct.status,
      createdAt: reelProduct.createdAt.toISOString(),
      updatedAt: reelProduct.updatedAt.toISOString(),
      gallery: reelProduct.gallery.map((item) => ({
        id: item.id,
        reelProductId: item.reelProductId,
        mediaType: item.mediaType,
        url: item.url,
        publicId: item.publicId,
        resourceType: item.resourceType,
        format: item.format,
        width: item.width,
        height: item.height,
        duration:
          item.duration === null
            ? null
            : Number(item.duration),
        bytes: item.bytes,
        altText: item.altText,
        displayOrder: item.displayOrder,
        isPrimary: item.isPrimary,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      product: {
        id: reelProduct.product.id,
        sku: reelProduct.product.sku,
        name: reelProduct.product.name,
        sellingPrice: Number(
          reelProduct.product.sellingPrice
        ),
        status: reelProduct.product.status,
        parent: {
          id: reelProduct.product.parent.id,
          sku: reelProduct.product.parent.sku,
          name: reelProduct.product.parent.name,
          status: reelProduct.product.parent.status,
        },
      },
      category: {
        id: reelProduct.category.id,
        name: reelProduct.category.name,
        status: reelProduct.category.status,
        source: {
          id: reelProduct.category.source.id,
          name: reelProduct.category.source.name,
          status: reelProduct.category.source.status,
        },
        page: {
          id: reelProduct.category.page.id,
          name: reelProduct.category.page.name,
          status: reelProduct.category.page.status,
        },
      },
    })
  );

  return (
    <ReelProductManager
      products={serialisedProducts}
      categories={serialisedCategories}
      reelProducts={serialisedReelProducts}
    />
  );
}