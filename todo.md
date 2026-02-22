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

## Phase 2: Auth and data foundation (current)

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

## Phase 3: Provider connection management

- Goal: allow users to connect AI providers safely.
- Deliverables:
  - Connection UI for OpenAI, Anthropic, Google.
  - Server-side encryption and storage of provider keys.
  - Credential validation endpoint.
- Verification:
  - Valid credentials pass, invalid credentials return actionable errors.
- Useful output:
  - Reliable provider onboarding experience.

## Phase 4: Multi-model orchestration and streaming

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

## Phase 5: Compare-chat UI

- Goal: deliver the primary user interaction experience.
- Deliverables:
  - Chat composer and model selection controls.
  - Expandable response cards per model.
  - Streaming, completed, and error states.
- Verification:
  - Users can prompt once and view per-model answers in real time.
- Useful output:
  - End-to-end user-facing MVP.

## Phase 6: Persistence and history

- Goal: enable continuity across sessions.
- Deliverables:
  - Save/reload chats and model responses.
  - History listing and replay views.
- Verification:
  - Past chats reload with consistent content and metadata.
- Useful output:
  - Practical daily-use workflow.

## Phase 7: Hardening and launch

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
