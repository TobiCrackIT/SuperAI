import { NextResponse } from "next/server";
import { hasProviderSecretsEncryptionKey } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createProviderConnection } from "@/server/providers/connections";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    if (!hasProviderSecretsEncryptionKey()) {
      return NextResponse.json(
        { error: "Provider encryption key is not configured." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const connection = await createProviderConnection(body);

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save provider connection.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
