import { describe, expect, it } from "vitest";
import { hasSupabaseClientEnv, parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("applies defaults when optional values are not provided", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Multi Model Compare");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("accepts valid configured values", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_NAME: "Prompt Arena",
      NEXT_PUBLIC_SITE_URL: "https://prompt-arena.example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    expect(env.NODE_ENV).toBe("test");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Prompt Arena");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://prompt-arena.example");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("detects when Supabase client environment values are configured", () => {
    expect(hasSupabaseClientEnv({})).toBe(false);
    expect(
      hasSupabaseClientEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toBe(true);
  });
});
