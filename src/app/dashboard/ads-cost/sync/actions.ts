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


export async function saveMetaCampaignMappings(input: {
  mappings: {
    campaignId: string;
    productParentId: string;
    sourceIds: string[];
  }[];
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const rows = (input.mappings || []).map((row) => ({
      campaignId: String(row.campaignId || "").trim(),
      productParentId: String(row.productParentId || "").trim(),
      sourceIds: cleanIds(row.sourceIds || []),
    }));

    if (!rows.length) {
      return { success: false, message: "No mapping changes to update." };
    }

    const duplicateCampaignIds = rows
      .map((row) => row.campaignId)
      .filter((id, index, all) => id && all.indexOf(id) !== index);

    if (duplicateCampaignIds.length) {
      return { success: false, message: "Duplicate campaign mapping found in update batch." };
    }

    for (const row of rows) {
      if (!row.campaignId) {
        return { success: false, message: "Campaign ID is required." };
      }

      const removing = !row.productParentId && row.sourceIds.length === 0;
      if (!removing && (!row.productParentId || !row.sourceIds.length)) {
        return {
          success: false,
          message: "Every changed campaign must have one Product Parent and at least one Source, or be fully cleared to remove the mapping.",
        };
      }
    }

    const campaignIds = rows.map((row) => row.campaignId);
    const parentIds = Array.from(
      new Set(rows.map((row) => row.productParentId).filter(Boolean))
    );
    const sourceIds = Array.from(
      new Set(rows.flatMap((row) => row.sourceIds))
    );

    const [campaignCount, parentCount, sourceCount] = await Promise.all([
      prisma.metaCampaign.count({ where: { id: { in: campaignIds } } }),
      parentIds.length
        ? prisma.productParent.count({ where: { id: { in: parentIds }, status: true } })
        : Promise.resolve(0),
      sourceIds.length
        ? prisma.orderSource.count({ where: { id: { in: sourceIds }, status: true } })
        : Promise.resolve(0),
    ]);

    if (campaignCount !== campaignIds.length) {
      return { success: false, message: "One or more campaigns are invalid." };
    }
    if (parentCount !== parentIds.length) {
      return { success: false, message: "One or more Product Parents are invalid or inactive." };
    }
    if (sourceCount !== sourceIds.length) {
      return { success: false, message: "One or more Sources are invalid or inactive." };
    }

    let saved = 0;
    let removed = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const removing = !row.productParentId && row.sourceIds.length === 0;

        if (removing) {
          const result = await tx.metaCampaignMapping.deleteMany({
            where: { campaignId: row.campaignId },
          });
          removed += result.count;
          continue;
        }

        const mapping = await tx.metaCampaignMapping.upsert({
          where: { campaignId: row.campaignId },
          create: {
            campaignId: row.campaignId,
            productParentId: row.productParentId,
          },
          update: {
            productParentId: row.productParentId,
          },
        });

        await tx.metaCampaignSource.deleteMany({
          where: { mappingId: mapping.id },
        });

        await tx.metaCampaignSource.createMany({
          data: row.sourceIds.map((sourceId) => ({
            mappingId: mapping.id,
            sourceId,
          })),
          skipDuplicates: true,
        });

        saved += 1;
      }
    });

    revalidatePath("/dashboard/ads-cost/sync");

    return {
      success: true,
      message: `Updated ${saved} campaign mapping(s)${removed ? ` and removed ${removed}` : ""}.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update campaign mappings.",
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
