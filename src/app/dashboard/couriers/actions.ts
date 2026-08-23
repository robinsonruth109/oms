"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import {
  decryptPathaoCredentials,
  encryptPathaoCredentials,
  encryptPathaoWebhookSecret,
} from "@/lib/pathao/crypto";
import { testPathaoConnection } from "@/lib/pathao/client";

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

function readRequired(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createCourier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const { prisma } = await import("@/lib/prisma");

    const name = readRequired(formData, "name");
    const slug = normalizeSlug(readRequired(formData, "slug") || name);
    const pathaoEnvironment =
      readRequired(formData, "pathaoEnvironment") === "SANDBOX"
        ? "SANDBOX"
        : "LIVE";

    const clientId = readRequired(formData, "clientId");
    const clientSecret = readRequired(formData, "clientSecret");
    const username = readRequired(formData, "username");
    const password = readRequired(formData, "password");
    const webhookSecret = readRequired(formData, "webhookSecret");
    const storeIdRaw = readRequired(formData, "storeId");
    const storeId = storeIdRaw ? Number(storeIdRaw) : null;

    if (!name || !slug) {
      return { success: false, message: "Courier name is required." };
    }

    if (!clientId || !clientSecret || !username || !password) {
      return {
        success: false,
        message:
          "Pathao Client ID, Client Secret, merchant username and password are required.",
      };
    }

    if (!webhookSecret) {
      return {
        success: false,
        message: "Pathao webhook secret is required.",
      };
    }

    if (storeIdRaw && (!Number.isInteger(storeId) || Number(storeId) <= 0)) {
      return { success: false, message: "Pathao Store ID is invalid." };
    }

    const existing = await prisma.courier.findFirst({
      where: { OR: [{ name }, { slug }] },
    });

    if (existing) {
      return {
        success: false,
        message: "Courier name or slug already exists.",
      };
    }

    const credentials = encryptPathaoCredentials({
      clientId,
      clientSecret,
      username,
      password,
    });
    const webhook = encryptPathaoWebhookSecret(webhookSecret);

    const courier = await prisma.courier.create({
      data: {
        name,
        slug,
        status: true,
        pathaoEnabled: true,
        pathaoEnvironment,
        pathaoCredentialsEncrypted: credentials.encrypted,
        pathaoCredentialsIv: credentials.iv,
        pathaoCredentialsTag: credentials.tag,
        pathaoWebhookSecretEncrypted: webhook.encrypted,
        pathaoWebhookSecretIv: webhook.iv,
        pathaoWebhookSecretTag: webhook.tag,
        pathaoStoreId: storeId,
      },
    });

    revalidatePath("/dashboard/couriers");

    return {
      success: true,
      message: `Pathao courier created. Test the connection to validate/store Pathao store information (${courier.name}).`,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("SHOP_SETTINGS_ENCRYPTION_KEY")
        ? "Configure SHOP_SETTINGS_ENCRYPTION_KEY on Railway before saving Pathao credentials."
        : "Failed to create Pathao courier.";

    return { success: false, message };
  }
}

export async function updateCourierPathao(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const { prisma } = await import("@/lib/prisma");

    const courierId = readRequired(formData, "courierId");
    const courier = await prisma.courier.findUnique({
      where: { id: courierId },
    });

    if (!courier) return { success: false, message: "Courier not found." };

    const current = decryptPathaoCredentials(courier);
    const clientId = readRequired(formData, "clientId") || current?.clientId || "";
    const clientSecret =
      readRequired(formData, "clientSecret") || current?.clientSecret || "";
    const username = readRequired(formData, "username") || current?.username || "";
    const password = readRequired(formData, "password") || current?.password || "";

    if (!clientId || !clientSecret || !username || !password) {
      return {
        success: false,
        message: "Complete Pathao credentials are required.",
      };
    }

    const pathaoEnvironment =
      readRequired(formData, "pathaoEnvironment") === "SANDBOX"
        ? "SANDBOX"
        : "LIVE";
    const storeIdRaw = readRequired(formData, "storeId");
    const storeId = storeIdRaw ? Number(storeIdRaw) : courier.pathaoStoreId;
    const webhookSecret = readRequired(formData, "webhookSecret");

    const credentials = encryptPathaoCredentials({
      clientId,
      clientSecret,
      username,
      password,
    });

    const webhookUpdate: Record<string, unknown> = {};
    if (webhookSecret) {
      const webhook = encryptPathaoWebhookSecret(webhookSecret);
      webhookUpdate.pathaoWebhookSecretEncrypted = webhook.encrypted;
      webhookUpdate.pathaoWebhookSecretIv = webhook.iv;
      webhookUpdate.pathaoWebhookSecretTag = webhook.tag;
    }

    await prisma.courier.update({
      where: { id: courierId },
      data: {
        pathaoEnabled: formData.get("pathaoEnabled") === "on",
        pathaoEnvironment,
        pathaoCredentialsEncrypted: credentials.encrypted,
        pathaoCredentialsIv: credentials.iv,
        pathaoCredentialsTag: credentials.tag,
        pathaoStoreId:
          storeId && Number.isInteger(Number(storeId)) ? Number(storeId) : null,
        pathaoTokenEncrypted: null,
        pathaoTokenIv: null,
        pathaoTokenTag: null,
        pathaoTokenExpiresAt: null,
        ...webhookUpdate,
      },
    });

    revalidatePath("/dashboard/couriers");
    return {
      success: true,
      message: "Pathao courier settings saved. Run Test Connection.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save Pathao settings.",
    };
  }
}

export async function testCourierPathao(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const courierId = readRequired(formData, "courierId");
    const { prisma } = await import("@/lib/prisma");

    const courier = await prisma.courier.findUnique({
      where: { id: courierId },
    });

    if (!courier) return { success: false, message: "Courier not found." };

    const stores = await testPathaoConnection(courierId);
    const activeStores = stores.filter(
      (store) => store.is_active === 1 || store.is_active === true
    );

    const selected =
      activeStores.find(
        (store) => Number(store.store_id) === Number(courier.pathaoStoreId)
      ) ||
      activeStores.find(
        (store) => store.is_default_store === 1 || store.is_default_store === true
      ) ||
      activeStores[0] ||
      stores[0];

    if (!selected) {
      throw new Error("Pathao login succeeded but no merchant store was returned.");
    }

    await prisma.courier.update({
      where: { id: courierId },
      data: {
        pathaoStoreId: Number(selected.store_id),
        pathaoStoreName: String(selected.store_name || courier.name),
        pathaoStoreAddress: selected.store_address
          ? String(selected.store_address)
          : null,
        pathaoLastTestedAt: new Date(),
        pathaoLastTestSuccess: true,
        pathaoLastTestMessage: `Connected. Store: ${
          selected.store_name || selected.store_id
        }`,
      },
    });

    revalidatePath("/dashboard/couriers");

    return {
      success: true,
      message: `Pathao connected successfully. Store: ${
        selected.store_name || selected.store_id
      } (ID ${selected.store_id}).`,
    };
  } catch (error) {
    const courierId = readRequired(formData, "courierId");
    try {
      const { prisma } = await import("@/lib/prisma");
      if (courierId) {
        await prisma.courier.update({
          where: { id: courierId },
          data: {
            pathaoLastTestedAt: new Date(),
            pathaoLastTestSuccess: false,
            pathaoLastTestMessage:
              error instanceof Error ? error.message : "Pathao test failed.",
          },
        });
      }
    } catch {
      // Keep the original API error.
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Pathao connection test failed.",
    };
  }
}

export async function toggleCourierStatus(
  courierId: string,
  nextStatus: boolean
) {
  await requireAdmin();
  const { prisma } = await import("@/lib/prisma");

  await prisma.courier.update({
    where: { id: courierId },
    data: { status: nextStatus },
  });

  revalidatePath("/dashboard/couriers");
}
