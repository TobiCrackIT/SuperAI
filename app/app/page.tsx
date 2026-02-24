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
    <main className="min-h-screen bg-[#0b0c10] px-2 py-2 text-zinc-100 sm:px-3 sm:py-3">
      <CompareChatWorkbench
        appName={env.NEXT_PUBLIC_APP_NAME}
        connections={connections}
        connectionsLoadError={connectionsError}
        defaultModelsByProvider={DEFAULT_MODELS_BY_PROVIDER}
        hasEncryptionKey={hasEncryptionKey}
        historyLoadError={historyError}
        initialHistoryRuns={historyRuns}
        signOutAction={signOut}
        suggestedModelsByProvider={SUGGESTED_MODELS_BY_PROVIDER}
        user={{
          id: user.id,
          email: user.email ?? null,
        }}
      />
    </main>
  );
}
