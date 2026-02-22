import { describe, expect, it } from "vitest";
import { getSiteUrl, sanitizeNextPath } from "@/lib/auth/redirect";

describe("sanitizeNextPath", () => {
  it("returns fallback when path is missing or unsafe", () => {
    expect(sanitizeNextPath(undefined)).toBe("/app");
    expect(sanitizeNextPath("https://evil.example")).toBe("/app");
    expect(sanitizeNextPath("//evil.example")).toBe("/app");
  });

  it("preserves safe internal paths", () => {
    expect(sanitizeNextPath("/app")).toBe("/app");
    expect(sanitizeNextPath("/app/chat?id=1")).toBe("/app/chat?id=1");
  });
});

describe("getSiteUrl", () => {
  it("prefers origin header", () => {
    expect(getSiteUrl("https://example.com/")).toBe("https://example.com");
  });

  it("falls back to localhost when no origin header exists", () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(getSiteUrl("")).toBe("http://localhost:3000");

    if (original) {
      process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });
});
