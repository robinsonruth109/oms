"use server";

import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateApiKey() {
  return crypto.randomBytes(24).toString("hex");
}

export async function createIntegration(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const slug = normalizeSlug(String(formData.get("slug") || "").trim());
    const platform = String(formData.get("platform") || "").trim();
    const sourceId = String(formData.get("sourceId") || "").trim();
    const webhookSecret = String(formData.get("webhookSecret") || "").trim();

    if (!name || !slug || !platform || !sourceId) {
      return {
        success: false,
        message: "Name, slug, platform and source are required.",
      };
    }

    if (!["SHOPIFY", "LARAVEL"].includes(platform)) {
      return {
        success: false,
        message: "Invalid platform selected.",
      };
    }

    const [existingSlug, source] = await Promise.all([
      prisma.integration.findUnique({
        where: { slug },
      }),
      prisma.orderSource.findUnique({
        where: { id: sourceId },
      }),
    ]);

    if (existingSlug) {
      return {
        success: false,
        message: "This slug already exists.",
      };
    }

    if (!source) {
      return {
        success: false,
        message: "Selected source not found.",
      };
    }

    await prisma.integration.create({
      data: {
        name,
        slug,
        platform: platform as "SHOPIFY" | "LARAVEL",
        sourceId,
        apiKey: generateApiKey(),
        webhookSecret: webhookSecret || null,
        status: true,
      },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "Integration created successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to create integration.",
    };
  }
}

export async function toggleIntegrationStatus(
  integrationId: string,
  nextStatus: boolean
): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: nextStatus },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "Integration status updated.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to update integration status.",
    };
  }
}

export async function regenerateIntegrationApiKey(
  integrationId: string
): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        apiKey: generateApiKey(),
      },
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      message: "API key regenerated successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to regenerate API key.",
    };
  }
}