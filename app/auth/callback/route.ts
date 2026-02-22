import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const callbackError = requestUrl.searchParams.get("error");
  const callbackErrorDescription =
    requestUrl.searchParams.get("error_description");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!hasSupabasePublicConfig()) {
    const redirectUrl = new URL("/auth/sign-in", requestUrl.origin);
    redirectUrl.searchParams.set(
      "error",
      "Supabase is not configured yet. Add the required environment variables.",
    );
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  if (callbackError) {
    const redirectUrl = new URL("/auth/sign-in", requestUrl.origin);
    redirectUrl.searchParams.set(
      "error",
      callbackErrorDescription ?? callbackError,
    );
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL("/auth/sign-in", requestUrl.origin);
    redirectUrl.searchParams.set("error", "Missing auth code in callback.");
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const redirectUrl = new URL("/auth/sign-in", requestUrl.origin);
    redirectUrl.searchParams.set("error", error.message);
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
