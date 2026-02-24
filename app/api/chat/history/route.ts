import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import {
  createCompareRunHistory,
  listCompareRunHistory,
} from "@/server/chat/history";
import { persistCompareRunRequestSchema } from "@/types/chat";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit =
      limitParam && Number.isFinite(Number(limitParam))
        ? Number(limitParam)
        : 12;

    const runs = await listCompareRunHistory(limit);
    return NextResponse.json({ runs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load chat history.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const payload = persistCompareRunRequestSchema.parse(body);
    const run = await createCompareRunHistory(payload);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid history payload.", issues: error.issues },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to save chat history.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
