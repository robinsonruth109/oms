import { decryptSecret, encryptSecret, maskSecret } from "@/lib/shop-settings-crypto";

import type { CourierCredentialInput, CourierProvider } from "./types";

type EncryptedColumns = {
  usernameEncrypted: string | null;
  usernameIv: string | null;
  usernameTag: string | null;
  passwordEncrypted: string | null;
  passwordIv: string | null;
  passwordTag: string | null;
};

export type StoredCourierCredential = EncryptedColumns & {
  provider: CourierProvider;
  enabled: boolean;
};

export type DecryptedCourierCredential = {
  provider: CourierProvider;
  enabled: boolean;
  username: string;
  password: string;
};

function decryptPart(encrypted: string | null, iv: string | null, tag: string | null): string {
  if (!encrypted || !iv || !tag) {
    return "";
  }

  return decryptSecret({ encrypted, iv, tag });
}

export function isCourierCredentialConfigured(value: EncryptedColumns): boolean {
  return Boolean(
    value.usernameEncrypted &&
      value.usernameIv &&
      value.usernameTag &&
      value.passwordEncrypted &&
      value.passwordIv &&
      value.passwordTag
  );
}

export function encryptCourierCredential(input: CourierCredentialInput): EncryptedColumns {
  const username = input.username?.trim() ?? "";
  const password = input.password?.trim() ?? "";

  if (!username || !password) {
    throw new Error("Courier username এবং password দুটোই দিতে হবে।");
  }

  const encryptedUsername = encryptSecret(username);
  const encryptedPassword = encryptSecret(password);

  return {
    usernameEncrypted: encryptedUsername.encrypted,
    usernameIv: encryptedUsername.iv,
    usernameTag: encryptedUsername.tag,
    passwordEncrypted: encryptedPassword.encrypted,
    passwordIv: encryptedPassword.iv,
    passwordTag: encryptedPassword.tag,
  };
}

export function decryptCourierCredential(value: StoredCourierCredential): DecryptedCourierCredential {
  if (!isCourierCredentialConfigured(value)) {
    throw new Error(`${value.provider} courier credentials are not configured.`);
  }

  return {
    provider: value.provider,
    enabled: value.enabled,
    username: decryptPart(value.usernameEncrypted, value.usernameIv, value.usernameTag),
    password: decryptPart(value.passwordEncrypted, value.passwordIv, value.passwordTag),
  };
}

export function serializeCourierCredential(value: StoredCourierCredential) {
  let usernameMasked: string | null = null;

  if (isCourierCredentialConfigured(value)) {
    try {
      usernameMasked = maskSecret(
        decryptPart(value.usernameEncrypted, value.usernameIv, value.usernameTag)
      );
    } catch {
      usernameMasked = "Configured (unable to decrypt with current key)";
    }
  }

  return {
    provider: value.provider,
    enabled: value.enabled,
    configured: isCourierCredentialConfigured(value),
    usernameMasked,
  };
}
