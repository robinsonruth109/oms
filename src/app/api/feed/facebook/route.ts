import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function xmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: unknown): string {
  return `<![CDATA[${String(value ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

function plainText(value: string | null | undefined): string {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const { prisma } = await import("@/lib/prisma");

  const products = await prisma.product.findMany({
    where: {
      status: true,
      parent: { status: true },
      reelProducts: {
        some: {
          status: true,
          category: {
            status: true,
            source: { status: true },
            page: { status: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      sku: true,
      name: true,
      quantity: true,
      sellingPrice: true,
      parent: {
        select: {
          sku: true,
        },
      },
      reelProducts: {
        where: {
          status: true,
          category: {
            status: true,
            source: { status: true },
            page: { status: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          caption: true,
          descriptionHtml: true,
          thumbnailUrl: true,
          gallery: {
            where: { mediaType: "IMAGE" },
            orderBy: [
              { isPrimary: "desc" },
              { displayOrder: "asc" },
              { createdAt: "asc" },
            ],
            take: 5,
            select: { url: true },
          },
        },
      },
    },
  });

  const items = products
    .map((product) => {
      const reel = product.reelProducts[0];
      if (!reel) return "";

      const image = reel.thumbnailUrl || reel.gallery[0]?.url;
      if (!image) return "";

      const description =
        plainText(reel.caption) ||
        plainText(reel.descriptionHtml) ||
        product.name;
      const price = Number(product.sellingPrice.toString());
      const productUrl = `${siteConfig.url}/product/${encodeURIComponent(product.sku)}`;
      const availability = product.quantity > 0 ? "in stock" : "out of stock";

      return [
        "<item>",
        `<g:id>${xmlText(product.sku)}</g:id>`,
        `<g:item_group_id>${xmlText(product.parent.sku)}</g:item_group_id>`,
        `<g:title>${cdata(product.name)}</g:title>`,
        `<g:description>${cdata(description)}</g:description>`,
        `<g:link>${xmlText(productUrl)}</g:link>`,
        `<g:image_link>${xmlText(image)}</g:image_link>`,
        `<g:price>${Number.isFinite(price) ? price.toFixed(2) : "0.00"} BDT</g:price>`,
        `<g:availability>${availability}</g:availability>`,
        "<g:condition>new</g:condition>",
        "<g:brand>Gloss &amp; Glows</g:brand>",
        "</item>",
      ].join("");
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Gloss &amp; Glows</title><link>${xmlText(siteConfig.url)}</link><description>Gloss &amp; Glows product catalog</description>${items}</channel></rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
