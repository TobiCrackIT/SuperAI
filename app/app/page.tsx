import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
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
            Protected app route is ready
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Phase 2 route protection is implemented, but Supabase environment
            variables are not configured in this workspace yet.
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

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Authenticated workspace (Phase 2 baseline)
              </h1>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                User ID
              </p>
              <p className="mt-2 text-sm break-all text-zinc-800">{user.id}</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                Email
              </p>
              <p className="mt-2 text-sm text-zinc-800">
                {user.email ?? "No email on file"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            What this phase unlocks
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">
            <li>Authenticated app shell and protected routes</li>
            <li>Supabase-backed user sessions (OAuth and magic-link)</li>
            <li>
              SQL migration + row-level security foundation for later phases
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
