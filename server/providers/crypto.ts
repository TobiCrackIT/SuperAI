import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env, hasProviderSecretsEncryptionKey } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

type EncryptedPayload = {
  cipherText: string;
  iv: string;
  tag: string;
  version: number;
};

function getEncryptionKeyBuffer(inputKey?: string): Buffer {
  const key = inputKey ?? env.PROVIDER_SECRETS_ENCRYPTION_KEY;

  if (
    !key ||
    !hasProviderSecretsEncryptionKey({ PROVIDER_SECRETS_ENCRYPTION_KEY: key })
  ) {
    throw new Error(
      "Provider secret encryption key is not configured. Set PROVIDER_SECRETS_ENCRYPTION_KEY to a base64-encoded 32-byte key.",
    );
  }

  let decoded: Buffer;

  try {
    decoded = Buffer.from(key, "base64");
  } catch {
    throw new Error("PROVIDER_SECRETS_ENCRYPTION_KEY must be valid base64.");
  }

  if (decoded.length !== 32) {
    throw new Error(
      "PROVIDER_SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes.",
    );
  }

  return decoded;
}

export function encryptSecret(secret: string, inputKey?: string): string {
  const key = getEncryptionKeyBuffer(inputKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const cipherText = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    version: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    cipherText: cipherText.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decryptSecret(
  encryptedValue: string,
  inputKey?: string,
): string {
  const key = getEncryptionKeyBuffer(inputKey);

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encryptedValue, "base64").toString("utf8"),
    ) as EncryptedPayload;
  } catch {
    throw new Error("Encrypted provider key payload is invalid.");
  }

  if (payload.version !== 1) {
    throw new Error(
      `Unsupported encrypted payload version: ${payload.version}`,
    );
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  const suffix = trimmed.slice(-4);
  return suffix ? `••••••••${suffix}` : "••••";
}
