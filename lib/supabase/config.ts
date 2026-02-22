import { env, hasSupabaseClientEnv } from "@/lib/env";

type SupabasePublicConfig = {
  anonKey: string;
  url: string;
};

export function hasSupabasePublicConfig(): boolean {
  return hasSupabaseClientEnv();
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  if (!hasSupabasePublicConfig()) {
    throw new Error(
      "Supabase client environment is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
  };
}
