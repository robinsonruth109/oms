import type { Message } from "firebase-admin/messaging";

import { getFirebaseMessagingClient } from "@/lib/firebase-admin";

export const NEW_PRODUCTS_TOPIC = "new-products";
export const NEW_PRODUCTS_ANDROID_CHANNEL_ID = "new-products";

type PushDataValue = string | number | boolean | null | undefined;

export type SendMobileTopicPushInput = {
  title: string;
  body: string;
  deeplink: string;
  imageUrl?: string | null;
  topic?: string;
  data?: Record<string, PushDataValue>;
};

function requireText(value: string, fieldName: string, maxLength: number) {
  const normalised = String(value ?? "").trim();

  if (!normalised) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalised.slice(0, maxLength);
}

function normaliseTopic(value?: string) {
  const topic = String(value ?? NEW_PRODUCTS_TOPIC).trim();

  if (!/^[a-zA-Z0-9-_.~%]+$/.test(topic)) {
    throw new Error("FCM topic contains unsupported characters.");
  }

  return topic;
}

function normaliseOptionalUrl(value?: string | null) {
  const url = String(value ?? "").trim();

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are supported.");
    }

    return parsed.toString();
  } catch {
    throw new Error("Push notification URL is invalid.");
  }
}

function normaliseData(
  values: Record<string, PushDataValue> | undefined
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(values ?? {})) {
    const safeKey = key.trim();

    if (!safeKey || value === null || value === undefined) {
      continue;
    }

    result[safeKey] = String(value);
  }

  return result;
}

export async function sendMobileTopicPush(
  input: SendMobileTopicPushInput
) {
  const title = requireText(input.title, "Push title", 120);
  const body = requireText(input.body, "Push body", 500);
  const deeplink = normaliseOptionalUrl(input.deeplink);
  const imageUrl = normaliseOptionalUrl(input.imageUrl);
  const topic = normaliseTopic(input.topic);

  if (!deeplink) {
    throw new Error("Push deeplink is required.");
  }

  const message: Message = {
    topic,
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: {
      ...normaliseData(input.data),
      deeplink,
      url: deeplink,
    },
    android: {
      priority: "high",
      notification: {
        channelId: NEW_PRODUCTS_ANDROID_CHANNEL_ID,
        sound: "default",
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };

  const messageId = await getFirebaseMessagingClient().send(message);

  return {
    messageId,
    topic,
  };
}
