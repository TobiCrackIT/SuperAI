import { NextResponse, type NextRequest } from "next/server";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { deleteProviderConnection } from "@/server/providers/connections";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    if (!hasSupabasePublicConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const { id } = await context.params;
    await deleteProviderConnection(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete provider connection.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
