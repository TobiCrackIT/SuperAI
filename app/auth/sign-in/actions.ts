"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteUrl, sanitizeNextPath } from "@/lib/auth/redirect";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildCallbackUrl(origin: string, nextPath: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

function signInRedirectWithError(nextPath: string, message: string): never {
  const signInUrl = new URL("/auth/sign-in", getSiteUrl());
  signInUrl.searchParams.set("next", nextPath);
  signInUrl.searchParams.set("error", message);
  redirect(signInUrl.pathname + signInUrl.search);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const nextPath = sanitizeNextPath(getString(formData, "next"));

  if (!hasSupabasePublicConfig()) {
    signInRedirectWithError(
      nextPath,
      "Supabase is not configured yet. Add the Supabase URL and anon key env vars.",
    );
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = getSiteUrl(headerStore.get("origin"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildCallbackUrl(origin, nextPath),
    },
  });

  if (error) {
    signInRedirectWithError(nextPath, error.message);
  }

  if (!data.url) {
    signInRedirectWithError(
      nextPath,
      "Google sign-in did not return a redirect URL.",
    );
  }

  redirect(data.url);
}

export async function signInWithMagicLink(formData: FormData): Promise<void> {
  const email = getString(formData, "email");
  const nextPath = sanitizeNextPath(getString(formData, "next"));

  if (!email) {
    signInRedirectWithError(
      nextPath,
      "Email is required for magic link sign-in.",
    );
  }

  if (!hasSupabasePublicConfig()) {
    signInRedirectWithError(
      nextPath,
      "Supabase is not configured yet. Add the Supabase URL and anon key env vars.",
    );
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = getSiteUrl(headerStore.get("origin"));

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildCallbackUrl(origin, nextPath),
    },
  });

  if (error) {
    signInRedirectWithError(nextPath, error.message);
  }

  const signInUrl = new URL("/auth/sign-in", origin);
  signInUrl.searchParams.set("next", nextPath);
  signInUrl.searchParams.set(
    "message",
    `Magic link sent to ${email}. Open your email to continue.`,
  );

  redirect(signInUrl.pathname + signInUrl.search);
}
