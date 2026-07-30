import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.SHOP_SETTINGS_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("SHOP_SETTINGS_ENCRYPTION_KEY is not configured.");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export type EncryptedSecret = {
  encrypted: string;
  iv: string;
  tag: string;
};

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(input: EncryptedSecret): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(input.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(input.encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value: string): string {
  if (value.length <= 10) {
    return "••••••••••";
  }

  return `${value.slice(0, 5)}••••••••••${value.slice(-4)}`;
}
