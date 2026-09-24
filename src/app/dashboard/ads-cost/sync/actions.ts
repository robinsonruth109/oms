"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMetaAdsRange } from "@/lib/meta-ads/sync";

type ActionResult = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized action.");
  }
  return session;
}

function cleanIds(values: string[]) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export async function saveMetaCampaignMapping(input: {
  campaignId: string;
  productParentId: string;
  sourceIds: string[];
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const campaignId = String(input.campaignId || "").trim();
    const productParentId = String(input.productParentId || "").trim();
    const sourceIds = cleanIds(input.sourceIds);

    if (!campaignId || !productParentId || !sourceIds.length) {
      return {
        success: false,
        message: "Select one Product Parent and at least one Source.",
      };
    }

    const [campaign, parent, sourceCount] = await Promise.all([
      prisma.metaCampaign.findUnique({ where: { id: campaignId }, select: { id: true } }),
      prisma.productParent.findUnique({ where: { id: productParentId }, select: { id: true } }),
      prisma.orderSource.count({ where: { id: { in: sourceIds }, status: true } }),
    ]);

    if (!campaign || !parent || sourceCount !== sourceIds.length) {
      return { success: false, message: "Campaign, Product Parent, or Source is invalid." };
    }

    await prisma.$transaction(async (tx) => {
      const mapping = await tx.metaCampaignMapping.upsert({
        where: { campaignId },
        create: { campaignId, productParentId },
        update: { productParentId },
      });

      await tx.metaCampaignSource.deleteMany({
        where: { mappingId: mapping.id },
      });

      await tx.metaCampaignSource.createMany({
        data: sourceIds.map((sourceId) => ({
          mappingId: mapping.id,
          sourceId,
        })),
        skipDuplicates: true,
      });
    });

    revalidatePath("/dashboard/ads-cost/sync");
    return {
      success: true,
      message: "Campaign mapping saved. Meta spend remains one amount; sources are merged only for order calculations.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save campaign mapping.",
    };
  }
}

export async function removeMetaCampaignMapping(
  campaignId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(campaignId || "").trim();
    if (!id) return { success: false, message: "Campaign ID is required." };

    await prisma.metaCampaignMapping.deleteMany({
      where: { campaignId: id },
    });

    revalidatePath("/dashboard/ads-cost/sync");
    return { success: true, message: "Campaign mapping removed." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove mapping.",
    };
  }
}

export async function toggleMetaAdAccount(
  accountId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    await requireAdmin();

    await prisma.metaAdAccount.update({
      where: { id: String(accountId || "").trim() },
      data: { enabled: Boolean(enabled) },
    });

    revalidatePath("/dashboard/ads-cost/sync");
    return {
      success: true,
      message: enabled ? "Ad account enabled." : "Ad account disabled.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update ad account.",
    };
  }
}

export async function syncMetaAdsNow(input: {
  accountId?: string;
  fromDate: string;
  toDate: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const result = await syncMetaAdsRange({
      accountId: String(input.accountId || "").trim() || undefined,
      fromDate: String(input.fromDate || "").trim(),
      toDate: String(input.toDate || "").trim(),
      mode: "MANUAL",
    });

    revalidatePath("/dashboard/ads-cost/sync");

    return {
      success: result.failureCount === 0 && result.successCount > 0,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Meta Ads sync failed.",
    };
  }
}

export async function disconnectMetaConnection(
  connectionId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(connectionId || "").trim();

    await prisma.$transaction([
      prisma.metaAdsConnection.update({
        where: { id },
        data: {
          status: false,
          lastSyncStatus: "DISCONNECTED",
          lastSyncMessage: "Disconnected from OMS.",
        },
      }),
      prisma.metaAdAccount.updateMany({
        where: { connectionId: id },
        data: { enabled: false },
      }),
    ]);

    revalidatePath("/dashboard/ads-cost/sync");
    return {
      success: true,
      message: "Meta connection disconnected. Historical spend and mappings were kept.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to disconnect Meta.",
    };
  }
}
