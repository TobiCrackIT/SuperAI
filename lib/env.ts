import { z } from "zod";

type EnvInput = Record<string, string | undefined>;

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Multi Model Compare"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PROVIDER_SECRETS_ENCRYPTION_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: EnvInput = process.env): AppEnv {
  return envSchema.parse({
    NODE_ENV: input.NODE_ENV,
    NEXT_PUBLIC_APP_NAME: input.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SITE_URL: input.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: input.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: input.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: input.SUPABASE_SERVICE_ROLE_KEY,
    PROVIDER_SECRETS_ENCRYPTION_KEY: input.PROVIDER_SECRETS_ENCRYPTION_KEY,
  });
}

export function hasSupabaseClientEnv(input: EnvInput = process.env): boolean {
  return Boolean(
    input.NEXT_PUBLIC_SUPABASE_URL && input.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasProviderSecretsEncryptionKey(
  input: EnvInput = process.env,
): boolean {
  return Boolean(input.PROVIDER_SECRETS_ENCRYPTION_KEY);
}

export const env = parseEnv();
