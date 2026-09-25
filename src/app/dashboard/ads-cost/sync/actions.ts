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

function mappingSignature(productParentId: string, sourceIds: string[]) {
  return String(productParentId || "").trim() +
    "::" +
    cleanIds(sourceIds).sort().join(",");
}

async function cleanupReportGroup(groupId: string | null | undefined) {
  const id = String(groupId || "").trim();
  if (!id) return;

  const mappings = await prisma.metaCampaignMapping.findMany({
    where: { reportGroupId: id },
    select: { id: true },
  });

  if (mappings.length > 1) return;

  if (mappings.length === 1) {
    await prisma.metaCampaignMapping.update({
      where: { id: mappings[0].id },
      data: { reportGroupId: null },
    });
  }

  await prisma.metaCampaignReportGroup.deleteMany({
    where: { id },
  });
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
    revalidatePath("/dashboard/ads-cost/report");
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

    const existingMappings = await prisma.metaCampaignMapping.findMany({
      where: { campaignId: { in: campaignIds } },
      include: { sources: true },
    });
    const existingByCampaign = new Map(
      existingMappings.map((mapping) => [mapping.campaignId, mapping])
    );
    const groupsToCleanup = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const removing = !row.productParentId && row.sourceIds.length === 0;

        if (removing) {
          const existing = existingByCampaign.get(row.campaignId);
          if (existing?.reportGroupId) groupsToCleanup.add(existing.reportGroupId);

          const result = await tx.metaCampaignMapping.deleteMany({
            where: { campaignId: row.campaignId },
          });
          removed += result.count;
          continue;
        }

        const existing = existingByCampaign.get(row.campaignId);
        const oldSignature = existing
          ? mappingSignature(
              existing.productParentId,
              existing.sources.map((item) => item.sourceId)
            )
          : "";
        const nextSignature = mappingSignature(
          row.productParentId,
          row.sourceIds
        );
        const shouldDisconnectGroup =
          Boolean(existing?.reportGroupId) && oldSignature !== nextSignature;

        if (shouldDisconnectGroup && existing?.reportGroupId) {
          groupsToCleanup.add(existing.reportGroupId);
        }

        const mapping = await tx.metaCampaignMapping.upsert({
          where: { campaignId: row.campaignId },
          create: {
            campaignId: row.campaignId,
            productParentId: row.productParentId,
          },
          update: {
            productParentId: row.productParentId,
            ...(shouldDisconnectGroup ? { reportGroupId: null } : {}),
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

    for (const groupId of groupsToCleanup) {
      await cleanupReportGroup(groupId);
    }

    revalidatePath("/dashboard/ads-cost/sync");
    revalidatePath("/dashboard/ads-cost/report");

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


export async function connectMetaCampaignToExisting(input: {
  campaignId: string;
  targetCampaignId: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const campaignId = String(input.campaignId || "").trim();
    const targetCampaignId = String(input.targetCampaignId || "").trim();

    if (!campaignId || !targetCampaignId || campaignId === targetCampaignId) {
      return {
        success: false,
        message: "Choose a different existing campaign to connect.",
      };
    }

    const mappings = await prisma.metaCampaignMapping.findMany({
      where: {
        campaignId: { in: [campaignId, targetCampaignId] },
      },
      include: {
        sources: true,
        campaign: {
          include: {
            adAccount: {
              select: { currency: true },
            },
          },
        },
      },
    });

    const current = mappings.find((row) => row.campaignId === campaignId);
    const target = mappings.find((row) => row.campaignId === targetCampaignId);

    if (!current || !target) {
      return {
        success: false,
        message: "Both campaigns must be mapped before they can be connected.",
      };
    }

    const currentSignature = mappingSignature(
      current.productParentId,
      current.sources.map((item) => item.sourceId)
    );
    const targetSignature = mappingSignature(
      target.productParentId,
      target.sources.map((item) => item.sourceId)
    );

    if (currentSignature !== targetSignature) {
      return {
        success: false,
        message:
          "Connected campaigns must use the same Product Parent and exactly the same Sources.",
      };
    }

    const currentCurrency = String(current.campaign.adAccount.currency || "").toUpperCase();
    const targetCurrency = String(target.campaign.adAccount.currency || "").toUpperCase();

    if (currentCurrency !== targetCurrency) {
      return {
        success: false,
        message: "Connected campaigns must use the same ad-account currency.",
      };
    }

    if (
      current.reportGroupId &&
      target.reportGroupId &&
      current.reportGroupId === target.reportGroupId
    ) {
      return {
        success: true,
        message: "These campaigns are already connected.",
      };
    }

    const previousGroupId = current.reportGroupId;

    let targetGroupId = target.reportGroupId;
    if (!targetGroupId) {
      const created = await prisma.metaCampaignReportGroup.create({
        data: {},
        select: { id: true },
      });
      targetGroupId = created.id;

      await prisma.metaCampaignMapping.update({
        where: { id: target.id },
        data: { reportGroupId: targetGroupId },
      });
    }

    await prisma.metaCampaignMapping.update({
      where: { id: current.id },
      data: { reportGroupId: targetGroupId },
    });

    if (previousGroupId && previousGroupId !== targetGroupId) {
      await cleanupReportGroup(previousGroupId);
    }

    revalidatePath("/dashboard/ads-cost/sync");
    revalidatePath("/dashboard/ads-cost/report");

    return {
      success: true,
      message: "Campaign connected. The Ads Cost Report will count OMS orders once for this group.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to connect campaign.",
    };
  }
}

export async function disconnectMetaCampaignReportGroup(
  campaignId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(campaignId || "").trim();
    if (!id) {
      return { success: false, message: "Campaign ID is required." };
    }

    const mapping = await prisma.metaCampaignMapping.findUnique({
      where: { campaignId: id },
      select: {
        id: true,
        reportGroupId: true,
      },
    });

    if (!mapping?.reportGroupId) {
      return {
        success: true,
        message: "Campaign is not connected to another campaign.",
      };
    }

    const groupId = mapping.reportGroupId;

    await prisma.metaCampaignMapping.update({
      where: { id: mapping.id },
      data: { reportGroupId: null },
    });

    await cleanupReportGroup(groupId);

    revalidatePath("/dashboard/ads-cost/sync");
    revalidatePath("/dashboard/ads-cost/report");

    return {
      success: true,
      message: "Campaign disconnected from the reporting group.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to disconnect campaign.",
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
    revalidatePath("/dashboard/ads-cost/report");
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
    revalidatePath("/dashboard/ads-cost/report");
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
    revalidatePath("/dashboard/ads-cost/report");
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
