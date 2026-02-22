import Link from "next/link";
import { env } from "@/lib/env";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
            {env.NEXT_PUBLIC_APP_NAME}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Ask multiple AI models the same question at once
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
            This app will let users send one prompt to several models and
            compare responses side by side as they stream in. Phase 2
            establishes auth, protected routes, and the Supabase data
            foundation.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
            >
              Open protected app route
            </Link>
          </div>
        </section>

        <aside className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            Current progress
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
            <li>Phase 1: Boilerplate and test tooling complete</li>
            <li>Phase 2: Supabase auth and route protection in progress</li>
            <li>
              Next: Provider connection management (OpenAI, Anthropic, Google)
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
