import { NextResponse } from "next/server";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { listProviderConnections } from "@/server/providers/connections";

export async function GET(): Promise<NextResponse> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const connections = await listProviderConnections();
    return NextResponse.json({ connections });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list provider connections.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
