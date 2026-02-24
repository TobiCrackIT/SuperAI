import Link from "next/link";
import { env } from "@/lib/env";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { signInWithGoogle } from "./actions";

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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(readFirst(params.next), "/app");
  const error = readFirst(params.error);
  const message = readFirst(params.message);
  const supabaseConfigured = hasSupabasePublicConfig();

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
      <div className="mx-auto grid w-full max-w-4xl gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
            {env.NEXT_PUBLIC_APP_NAME}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Sign in to start comparing AI answers
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Phase 2 includes Google OAuth and email magic-link sign-in through
            Supabase Auth. Provider API connections will be added in Phase 3.
          </p>

          {!supabaseConfigured ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Supabase environment variables are not configured yet. Add values
              for <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable sign-in.
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

          <div className="mt-8 space-y-4">
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Continue with Google
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs tracking-[0.18em] text-zinc-400 uppercase">
              <span className="h-px flex-1 bg-zinc-200" />
              Or
              <span className="h-px flex-1 bg-zinc-200" />
            </div>

            <form
              action="/auth/magic-link/start"
              method="post"
              className="space-y-3"
            >
              <input type="hidden" name="next" value={nextPath} />
              <label className="block text-sm font-medium text-zinc-700">
                Email address
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                disabled={!supabaseConfigured}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm ring-0 outline-none placeholder:text-zinc-400 focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <button
                type="submit"
                disabled={!supabaseConfigured}
                className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send magic link
              </button>
              <p className="text-xs leading-5 text-zinc-500">
                Open the email link in this same browser and on the same host
                (for example <code>localhost</code>, not <code>127.0.0.1</code>
                ).
              </p>
            </form>
          </div>

          <div className="mt-8 text-sm text-zinc-500">
            <Link
              href="/"
              className="underline decoration-zinc-300 underline-offset-4"
            >
              Back to landing page
            </Link>
          </div>
        </section>

        <aside className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            Phase 2 scope
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
            <li>Supabase Auth integration (Google + magic link)</li>
            <li>Protected route baseline for the app workspace</li>
            <li>Postgres schema migration and row-level security policies</li>
          </ul>
          <p className="mt-6 text-xs leading-5 text-zinc-500">
            Configure the callback URL in Supabase Auth settings to point to{" "}
            <code>{env.NEXT_PUBLIC_SITE_URL}/auth/callback</code>.
          </p>
        </aside>
      </div>
    </main>
  );
}
