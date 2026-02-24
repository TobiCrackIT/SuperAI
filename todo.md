# Project Phases

## Phase 1: Boilerplate and scaffolding (completed)

- Goal: establish the project foundation with tooling and folder structure.
- Deliverables:
  - Next.js + TypeScript + Tailwind scaffold.
  - Linting, formatting, unit test, and e2e test configuration.
  - Base folders and environment validation bootstrap.
  - `plan.md` and phased `todo.md`.
- Verification:
  - `npm run lint`
  - `npm run test`
  - `npm run test:e2e`
- Useful output:
  - A clean baseline codebase ready for feature phases.

## Phase 2: Auth and data foundation (completed)

- Goal: implement user identity and persistent data layer.
- Deliverables:
  - Supabase Auth with Google and magic-link.
  - Postgres schema, migrations, and row-level security.
  - Protected route baseline.
- Verification:
  - Users can authenticate and protected routes enforce access.
  - DB migrations apply cleanly.
- Useful output:
  - Secure user and data infrastructure.

## Phase 3: Provider connection management (completed)

- Goal: allow users to connect AI providers safely.
- Deliverables:
  - Connection UI for OpenAI, Anthropic, Google.
  - Server-side encryption and storage of provider keys.
  - Credential validation endpoint.
- Verification:
  - Valid credentials pass, invalid credentials return actionable errors.
- Useful output:
  - Reliable provider onboarding experience.

## Phase 4: Multi-model orchestration and streaming (completed)

- Goal: dispatch one prompt to many models concurrently.
- Deliverables:
  - Shared adapter contract + provider implementations.
  - Parallel fan-out orchestration.
  - Streaming response endpoint with isolated failure handling.
- Verification:
  - Concurrent responses stream independently.
  - Single-provider failure does not break others.
- Useful output:
  - Core multi-model compare engine.

## Phase 5: Compare-chat UI (completed)

- Goal: deliver the primary user interaction experience.
- Deliverables:
  - Chat composer and model selection controls.
  - Expandable response cards per model.
  - Streaming, completed, and error states.
- Verification:
  - Users can prompt once and view per-model answers in real time.
- Useful output:
  - End-to-end user-facing MVP.

## Phase 6: Persistence and history (completed)

- Goal: enable continuity across sessions.
- Deliverables:
  - Save/reload chats and model responses.
  - History listing and replay views.
- Verification:
  - Past chats reload with consistent content and metadata.
- Useful output:
  - Practical daily-use workflow.

## Phase 7: UI/UX redesign (completed)

- Goal: improve the interface and user experience to match the attached screenshot style (ChatGPT-like layout and interaction feel).
- Deliverables:
  - Dark, polished app shell with left sidebar navigation and clean top bar.
  - Centered hero/chat state with large prompt entry surface styled like the screenshot.
  - Improved spacing, typography, contrast, icons, and hover/focus states.
  - Responsive behavior for desktop and mobile while preserving the core layout feel.
  - Refined compare response cards so they visually fit the new interface.
- Verification:
  - Main `/app` workspace visually matches the reference layout direction (sidebar + centered composer + dark theme shell).
  - Prompting and streaming interactions remain usable and readable after redesign.
  - Keyboard navigation and focus visibility still work in the redesigned UI.
- Useful output:
  - A production-quality interface direction with a much better first impression and usability.

## Phase 8: Hardening and launch (current)

- Goal: prepare production-ready reliability and deployment.
- Deliverables:
  - Retry/backoff, timeout, and rate-limit safeguards.
  - Observability and deployment runbook.
  - Release smoke-test checklist.
- Verification:
  - Non-happy paths are handled cleanly.
  - Production deploy succeeds with validated runtime behavior.
- Useful output:
  - Launch-ready application baseline.

## Phase 9: Provider auth options (API key default + OAuth where available) (planned)

- Goal: let users connect providers using API keys by default, with OAuth as an optional path for providers that officially support third-party OAuth access.
- Deliverables:
  - Provider connection UX that supports selecting an auth method (`API key` default, `OAuth` when available).
  - Provider capability matrix and UI messaging that clearly shows which providers/models support OAuth vs API key only.
  - OAuth connect/callback/token refresh flows for supported providers.
  - Secure token/key storage, rotation handling, and disconnect/re-auth flows.
  - Policy/compliance guardrails to prevent unsupported consumer-login flows (for example, providers that only permit API keys for third-party apps).
- Verification:
  - Users can successfully connect providers with API keys across all supported providers.
  - Users can complete OAuth connection for supported providers and reconnect after token expiry.
  - Unsupported OAuth attempts are blocked with clear guidance and fallback to API key.
  - Existing provider key connections continue working after auth-method support is added.
- Useful output:
  - Flexible provider onboarding with a safe default (API keys) and OAuth convenience where officially supported.
