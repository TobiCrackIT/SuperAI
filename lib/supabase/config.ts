import { hasSupabaseClientEnv } from "@/lib/env";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    anonKey: anonKey!,
    url: url!,
  };
}
