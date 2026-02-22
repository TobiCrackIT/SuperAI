# Multi-Model Compare Chat: Build Plan

## 1. Initialize project boilerplate

- Create a Next.js app with TypeScript, Tailwind CSS, and App Router.
- Add ESLint, Prettier, Vitest, and Playwright configuration.
- Create baseline folders for feature growth: `components/`, `lib/`, `server/`, `types/`, and `tests/`.
- Add environment template and validation module.

## 2. Set up Supabase foundation

- Configure Supabase for Postgres and authentication.
- Enable Google OAuth and email magic-link auth.
- Create initial schema migrations and row-level security.

## 3. Implement auth and session flows

- Build sign-in and sign-out flows.
- Protect app routes and API routes with authenticated sessions.
- Add a minimal dashboard/chat landing route behind auth.

## 4. Build provider connection management

- Create settings UI for adding provider credentials.
- Encrypt provider keys before persistence.
- Add connection test endpoint for credential validation.

## 5. Implement model adapter layer

- Define unified adapter interfaces for OpenAI, Anthropic, and Google.
- Add provider-specific request and stream handlers.
- Normalize model metadata and response chunk shapes.

## 6. Implement parallel dispatch and response streaming

- Fan out one prompt to selected providers concurrently.
- Stream provider responses independently to the client.
- Isolate provider failures so successful streams continue.

## 7. Build compare-chat interface

- Create chat-style input composer and model selector.
- Render each model response in expandable cards.
- Display loading, streaming, success, and error states per card.

## 8. Add persistence and chat history

- Persist prompt and per-model responses.
- Build chat history list and chat replay view.
- Restore selected models and context for prior sessions.

## 9. Hardening and polish

- Add retries, timeouts, and rate limiting.
- Add structured logs and request tracing.
- Improve accessibility and responsive behavior.

## 10. Verify and deploy

- Run full lint, unit, and e2e checks.
- Deploy to Vercel with managed Postgres.
- Add setup/runbook documentation and smoke-test checklist.
