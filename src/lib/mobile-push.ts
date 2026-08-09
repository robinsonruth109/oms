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

  /*
   * IMPORTANT:
   * Do not add a top-level `notification` payload here.
   *
   * Android background notification payloads are displayed directly by FCM
   * and bypass FirebaseMessagingService.onMessageReceived(). Gloss & Glows
   * needs onMessageReceived() to enforce the customer's local notification
   * preference before displaying anything.
   *
   * Android therefore receives a high-priority DATA-ONLY message.
   *
   * Apple can still receive a visible alert later through the APNs-specific
   * aps.alert payload without turning the Android message into a notification
   * payload.
   */
  const message: Message = {
    topic,
    data: {
      ...normaliseData(input.data),
      title,
      body,
      deeplink,
      url: deeplink,
      ...(imageUrl ? { imageUrl } : {}),
    },
    android: {
      priority: "high",
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: "default",
        },
      },
      ...(imageUrl
        ? {
            fcmOptions: {
              imageUrl,
            },
          }
        : {}),
    },
  };

  const messageId = await getFirebaseMessagingClient().send(message);

  return {
    messageId,
    topic,
  };
}
