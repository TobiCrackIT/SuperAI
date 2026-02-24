import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { getCompareRunHistoryById } from "@/server/chat/history";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const { id } = await context.params;
    const run = await getCompareRunHistoryById(id);
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid history id.", issues: error.issues },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load chat history item.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
