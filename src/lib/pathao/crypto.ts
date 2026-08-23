import { decryptSecret, encryptSecret } from "@/lib/shop-settings-crypto";
import type { PathaoCredentials, PathaoTokenBundle } from "./types";

type EncryptedTriple = {
  encrypted: string | null;
  iv: string | null;
  tag: string | null;
};

function decryptJson<T>(input: EncryptedTriple): T | null {
  if (!input.encrypted || !input.iv || !input.tag) return null;

  return JSON.parse(
    decryptSecret({
      encrypted: input.encrypted,
      iv: input.iv,
      tag: input.tag,
    })
  ) as T;
}

export function encryptPathaoCredentials(value: PathaoCredentials) {
  return encryptSecret(JSON.stringify(value));
}

export function decryptPathaoCredentials(row: {
  pathaoCredentialsEncrypted: string | null;
  pathaoCredentialsIv: string | null;
  pathaoCredentialsTag: string | null;
}) {
  return decryptJson<PathaoCredentials>({
    encrypted: row.pathaoCredentialsEncrypted,
    iv: row.pathaoCredentialsIv,
    tag: row.pathaoCredentialsTag,
  });
}

export function encryptPathaoToken(value: PathaoTokenBundle) {
  return encryptSecret(JSON.stringify(value));
}

export function decryptPathaoToken(row: {
  pathaoTokenEncrypted: string | null;
  pathaoTokenIv: string | null;
  pathaoTokenTag: string | null;
}) {
  return decryptJson<PathaoTokenBundle>({
    encrypted: row.pathaoTokenEncrypted,
    iv: row.pathaoTokenIv,
    tag: row.pathaoTokenTag,
  });
}

export function encryptPathaoWebhookSecret(secret: string) {
  return encryptSecret(secret);
}

export function decryptPathaoWebhookSecret(row: {
  pathaoWebhookSecretEncrypted: string | null;
  pathaoWebhookSecretIv: string | null;
  pathaoWebhookSecretTag: string | null;
}) {
  if (
    !row.pathaoWebhookSecretEncrypted ||
    !row.pathaoWebhookSecretIv ||
    !row.pathaoWebhookSecretTag
  ) {
    return null;
  }

  return decryptSecret({
    encrypted: row.pathaoWebhookSecretEncrypted,
    iv: row.pathaoWebhookSecretIv,
    tag: row.pathaoWebhookSecretTag,
  });
}
