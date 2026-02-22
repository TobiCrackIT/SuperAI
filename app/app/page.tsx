import Link from "next/link";
import { redirect } from "next/navigation";
import { CompareChatWorkbench } from "@/components/chat/compare-chat-workbench";
import { env, hasProviderSecretsEncryptionKey } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MODELS_BY_PROVIDER,
  SUGGESTED_MODELS_BY_PROVIDER,
} from "@/server/chat/catalog";
import { listCompareRunHistory } from "@/server/chat/history";
import { listProviderConnections } from "@/server/providers/connections";
import type { CompareRunHistoryRecord } from "@/types/chat";
import type { ProviderConnectionSummary } from "@/types/providers";
import { signOut } from "./actions";

export default async function AppHomePage() {
  if (!hasSupabasePublicConfig()) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
            {env.NEXT_PUBLIC_APP_NAME}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Compare workspace is ready
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Configure Supabase environment variables to enable sign-in and
            access the compare-chat interface.
          </p>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then retry sign-in.
          </div>
          <Link
            href="/auth/sign-in"
            className="mt-6 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
          >
            Go to sign-in
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/app");
  }

  let connections: ProviderConnectionSummary[] = [];
  let connectionsError: string | null = null;
  let historyRuns: CompareRunHistoryRecord[] = [];
  let historyError: string | null = null;

  try {
    connections =
      (await listProviderConnections()) as ProviderConnectionSummary[];
  } catch (error) {
    connectionsError =
      error instanceof Error
        ? error.message
        : "Failed to load provider connections.";
  }

  try {
    historyRuns = await listCompareRunHistory(12);
  } catch (error) {
    historyError =
      error instanceof Error
        ? error.message
        : "Failed to load compare history.";
  }

  const hasEncryptionKey = hasProviderSecretsEncryptionKey();

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Multi-model compare workspace
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Phase 5 adds the chat-style compare UI on top of the Phase 4
                streaming orchestration endpoint.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/providers"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
              >
                Provider settings
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                User
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {user.email ?? "No email on file"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                Saved provider connections
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {connections.length}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                Streaming endpoint
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                <code>/api/chat/stream</code>
              </p>
            </div>
          </div>

          {!hasEncryptionKey ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Provider secret storage is not fully configured. Add{" "}
              <code>PROVIDER_SECRETS_ENCRYPTION_KEY</code> to enable saved API
              key retrieval for compare streaming.
            </div>
          ) : null}

          {connectionsError ? (
            <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              Failed to load provider connections: {connectionsError}. If you
              have not applied the Supabase migrations yet, run them before
              using the compare UI.
            </div>
          ) : null}

          {historyError ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Compare history could not be loaded: {historyError}. Apply the
              Phase 6 migration before using saved run history.
            </div>
          ) : null}
        </section>

        <CompareChatWorkbench
          connections={connections}
          defaultModelsByProvider={DEFAULT_MODELS_BY_PROVIDER}
          initialHistoryRuns={historyRuns}
          suggestedModelsByProvider={SUGGESTED_MODELS_BY_PROVIDER}
          user={{
            id: user.id,
            email: user.email ?? null,
          }}
        />
      </div>
    </main>
  );
}
