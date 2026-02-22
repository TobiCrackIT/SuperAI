import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasProviderSecretsEncryptionKey } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createCompareChatStream } from "@/server/chat/orchestrator";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    if (!hasProviderSecretsEncryptionKey()) {
      return NextResponse.json(
        {
          error:
            "Provider secret encryption key is not configured. Set PROVIDER_SECRETS_ENCRYPTION_KEY.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { requestId, stream } = await createCompareChatStream(body, {
      abortSignal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Compare-Request-Id": requestId,
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to start compare stream.";
    const status = message === "Unauthorized" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
