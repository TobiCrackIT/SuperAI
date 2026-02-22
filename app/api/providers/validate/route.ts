import { NextResponse } from "next/server";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { getAuthenticatedUserOrThrow } from "@/server/providers/connections";
import {
  providerValidateInputSchema,
  validateProviderCredentials,
} from "@/server/providers/validators";
import type { ProviderId } from "@/types/providers";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    await getAuthenticatedUserOrThrow();

    const body = await request.json();
    const parsed = providerValidateInputSchema.parse(body);
    const result = await validateProviderCredentials(
      parsed.provider as ProviderId,
      parsed.apiKey,
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation failed.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
