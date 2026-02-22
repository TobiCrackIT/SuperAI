import Link from "next/link";
import { redirect } from "next/navigation";
import { hasProviderSecretsEncryptionKey } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import {
  getAuthenticatedUserOrThrow,
  listProviderConnections,
} from "@/server/providers/connections";
import { PROVIDER_LABELS, PROVIDERS } from "@/types/providers";
import {
  createProviderConnectionAction,
  deleteProviderConnectionAction,
  updateProviderConnectionAction,
} from "./actions";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function readFirst(
  value: string | string[] | undefined,
  fallback = "",
): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export default async function ProviderSettingsPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const params = await searchParams;
  const message = readFirst(params.message);
  const error = readFirst(params.error);

  const supabaseConfigured = hasSupabasePublicConfig();
  const encryptionConfigured = hasProviderSecretsEncryptionKey();

  if (!supabaseConfigured) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
        <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Provider connections
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Configure Supabase first before managing provider credentials.
          </p>
          <Link
            href="/app"
            className="mt-6 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
          >
            Back to app
          </Link>
        </div>
      </main>
    );
  }

  try {
    await getAuthenticatedUserOrThrow();
  } catch {
    redirect("/auth/sign-in?next=/app/providers");
  }

  const connections = encryptionConfigured
    ? await listProviderConnections()
    : [];

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
                Phase 3
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Provider connection settings
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Add and manage API keys for OpenAI, Anthropic, and Google. Keys
                are validated before save and encrypted at rest.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/app"
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
              >
                Back to app
              </Link>
            </div>
          </div>

          {!encryptionConfigured ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Add <code>PROVIDER_SECRETS_ENCRYPTION_KEY</code> (base64-encoded
              32-byte key) to enable provider key storage.
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            Add provider connection
          </h2>
          <form
            action={createProviderConnectionAction}
            className="mt-5 grid gap-4 md:grid-cols-[180px_1fr_1.2fr_auto]"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Provider
              <select
                name="provider"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                defaultValue="openai"
                disabled={!encryptionConfigured}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABELS[provider]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Label
              <input
                name="label"
                required
                placeholder="Personal key"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                disabled={!encryptionConfigured}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              API key
              <input
                name="apiKey"
                type="password"
                required
                placeholder="Paste provider API key"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                disabled={!encryptionConfigured}
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!encryptionConfigured}
              >
                Save
              </button>
            </div>
          </form>

          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Validation endpoint available at{" "}
            <code>/api/providers/validate</code> for authenticated requests.
          </p>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              Connected providers
            </h2>
            <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
              {connections.length} total
            </span>
          </div>

          {connections.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-600">
              No provider connections saved yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                        {PROVIDER_LABELS[connection.provider]}
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-900">
                        {connection.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Stored key: {connection.api_key_mask}
                      </p>
                      {connection.last_validation_message ? (
                        <p className="mt-2 text-xs text-zinc-600">
                          Last validation: {connection.last_validation_message}
                        </p>
                      ) : null}
                    </div>

                    <form action={deleteProviderConnectionAction}>
                      <input type="hidden" name="id" value={connection.id} />
                      <button
                        type="submit"
                        className="inline-flex rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </form>
                  </div>

                  <form
                    action={updateProviderConnectionAction}
                    className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_1.2fr_auto]"
                  >
                    <input type="hidden" name="id" value={connection.id} />
                    <input
                      type="hidden"
                      name="provider"
                      value={connection.provider}
                    />

                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      Provider
                      <input
                        value={PROVIDER_LABELS[connection.provider]}
                        readOnly
                        className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      Label
                      <input
                        name="label"
                        defaultValue={connection.label}
                        required
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      Replace API key (optional)
                      <input
                        name="apiKey"
                        type="password"
                        placeholder="Leave blank to keep current key"
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
                      >
                        Update
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
