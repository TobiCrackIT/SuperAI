import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "@/server/providers/crypto";

const testKey = Buffer.alloc(32, 7).toString("base64");

describe("provider secret crypto", () => {
  it("encrypts and decrypts provider API keys", () => {
    const encrypted = encryptSecret("sk-test-123456", testKey);
    const decrypted = decryptSecret(encrypted, testKey);

    expect(encrypted).not.toContain("sk-test-123456");
    expect(decrypted).toBe("sk-test-123456");
  });

  it("masks secrets for UI display", () => {
    expect(maskSecret("sk-test-123456")).toBe("••••••••3456");
  });
});
