import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { getSupabasePublicConfig, hasSupabasePublicConfig } from "@/lib/supabase/config";

function buildSignInRedirect(
  request: NextRequest,
  nextPath: string,
  params: Record<string, string>,
): NextResponse {
  const redirectUrl = new URL("/auth/sign-in", request.nextUrl.origin);
  redirectUrl.searchParams.set("next", nextPath);

  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const nextValue = formData.get("next");

  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const nextPath = sanitizeNextPath(
    typeof nextValue === "string" ? nextValue : undefined,
    "/app",
  );

  if (!email) {
    return buildSignInRedirect(request, nextPath, {
      error: "Email is required for magic link sign-in.",
    });
  }

  if (!hasSupabasePublicConfig()) {
    return buildSignInRedirect(request, nextPath, {
      error:
        "Supabase is not configured yet. Add the Supabase URL and anon key env vars.",
    });
  }

  const { anonKey, url } = getSupabasePublicConfig();
  let cookieCarrier = new NextResponse(null, { status: 204 });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookieCarrier = new NextResponse(null, { status: 204 });
        for (const { name, options, value } of cookiesToSet) {
          cookieCarrier.cookies.set(name, value, options);
        }
      },
    },
  });

  const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
  callbackUrl.searchParams.set("next", nextPath);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  const response = error
    ? buildSignInRedirect(request, nextPath, { error: error.message })
    : buildSignInRedirect(request, nextPath, {
        message: `Magic link sent to ${email}. Open the link in this same browser.`,
      });

  for (const cookie of cookieCarrier.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return response;
}
