"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  CompareRunHistoryRecord,
  CompareStreamEvent,
  PersistCompareRunRequest,
} from "@/types/chat";
import {
  PROVIDER_LABELS,
  type ProviderConnectionSummary,
  type ProviderId,
} from "@/types/providers";

type ModelCatalog = Record<ProviderId, string[]>;
type DefaultModelCatalog = Record<ProviderId, string>;

type ProviderSelection = {
  connectionId: string;
  label: string;
  model: string;
  provider: ProviderId;
  selected: boolean;
};

type CompareTargetCard = {
  connectionId: string | null;
  content: string;
  error?: string;
  finishReason?: string;
  id: string;
  label: string;
  model: string;
  provider: ProviderId;
  status: "queued" | "streaming" | "done" | "error";
};

type CompareRun = {
  createdAt: string;
  error?: string;
  historyId?: string;
  id: string;
  persistedAt?: string;
  persistState: "idle" | "saving" | "saved" | "save_error";
  prompt: string;
  requestId?: string;
  status: "streaming" | "complete" | "error" | "aborted";
  targets: CompareTargetCard[];
};

type CompareChatWorkbenchProps = {
  connections: ProviderConnectionSummary[];
  defaultModelsByProvider: DefaultModelCatalog;
  initialHistoryRuns: CompareRunHistoryRecord[];
  suggestedModelsByProvider: ModelCatalog;
  user: {
    email: string | null;
    id: string;
  };
};

function readErrorMessage(input: unknown): string {
  if (!input) {
    return "Unknown error.";
  }

  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "object" && "error" in input) {
    const value = (input as { error?: unknown }).error;
    if (typeof value === "string") {
      return value;
    }
  }

  return "Unknown error.";
}

function buildInitialSelections(
  connections: ProviderConnectionSummary[],
  defaults: DefaultModelCatalog,
): ProviderSelection[] {
  return connections
    .filter((connection) => connection.status === "active")
    .map((connection) => ({
      connectionId: connection.id,
      provider: connection.provider,
      label: connection.label,
      model: defaults[connection.provider],
      selected: true,
    }));
}

function createRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function providerDotClass(status: CompareTargetCard["status"]): string {
  switch (status) {
    case "done":
      return "bg-emerald-500";
    case "error":
      return "bg-red-500";
    case "streaming":
      return "bg-amber-500";
    default:
      return "bg-zinc-300";
  }
}

function parseSseFrames(buffer: string): {
  events: CompareStreamEvent[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const rawEvents = normalized.split("\n\n");
  const completeRawEvents = rawEvents.slice(0, -1);
  const rest = rawEvents.at(-1) ?? "";
  const events: CompareStreamEvent[] = [];

  for (const rawEvent of completeRawEvents) {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join("\n");

    try {
      events.push(JSON.parse(payload) as CompareStreamEvent);
    } catch {
      continue;
    }
  }

  return { events, rest };
}

async function readResponseError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as unknown;
    return readErrorMessage(json);
  } catch {
    try {
      return await response.text();
    } catch {
      return `Request failed with status ${response.status}.`;
    }
  }
}

function historyRunToUiRun(historyRun: CompareRunHistoryRecord): CompareRun {
  return {
    id: `history:${historyRun.id}`,
    historyId: historyRun.id,
    prompt: historyRun.prompt,
    requestId: historyRun.requestId ?? undefined,
    createdAt: historyRun.createdAt,
    persistedAt: historyRun.updatedAt,
    status: historyRun.status,
    error: historyRun.sessionError ?? undefined,
    persistState: "saved",
    targets: historyRun.targets.map((target) => ({
      id: target.targetId,
      connectionId: target.connectionId,
      provider: target.provider,
      label: target.connectionLabel,
      model: target.model,
      content: target.content,
      error: target.error ?? undefined,
      finishReason: target.finishReason ?? undefined,
      status: target.status,
    })),
  };
}

function applyStreamEvent(
  run: CompareRun,
  event: CompareStreamEvent,
): CompareRun {
  switch (event.type) {
    case "session_started":
      return {
        ...run,
        requestId: event.requestId,
        status: "streaming",
      };
    case "target_started":
      return {
        ...run,
        targets: run.targets.map((target) =>
          target.id === event.targetId
            ? { ...target, status: "streaming" }
            : target,
        ),
      };
    case "target_chunk":
      return {
        ...run,
        targets: run.targets.map((target) =>
          target.id === event.targetId
            ? {
                ...target,
                status: "streaming",
                content: target.content + event.delta,
              }
            : target,
        ),
      };
    case "target_done":
      return {
        ...run,
        targets: run.targets.map((target) =>
          target.id === event.targetId
            ? {
                ...target,
                status: "done",
                finishReason: event.finishReason,
              }
            : target,
        ),
      };
    case "target_error":
      return {
        ...run,
        targets: run.targets.map((target) =>
          target.id === event.targetId
            ? {
                ...target,
                status: "error",
                error: event.error,
              }
            : target,
        ),
      };
    case "session_complete":
      return {
        ...run,
        status: "complete",
      };
    default:
      return run;
  }
}

function buildPersistPayload(run: CompareRun): PersistCompareRunRequest | null {
  if (
    !(
      run.status === "complete" ||
      run.status === "error" ||
      run.status === "aborted"
    )
  ) {
    return null;
  }

  return {
    prompt: run.prompt,
    requestId: run.requestId,
    status: run.status,
    sessionError: run.error,
    targets: run.targets.map((target) => ({
      targetId: target.id,
      provider: target.provider,
      connectionId: target.connectionId ?? undefined,
      connectionLabel: target.label,
      model: target.model,
      status: target.status,
      content: target.content,
      error: target.error,
      finishReason: target.finishReason,
    })),
  };
}

function cloneHistoryRunIntoWorkspace(
  historyRun: CompareRunHistoryRecord,
): CompareRun {
  const base = historyRunToUiRun(historyRun);

  return {
    ...base,
    id: `replay:${historyRun.id}:${Date.now()}`,
  };
}

function getCardStateKey(runId: string, targetId: string): string {
  return `${runId}:${targetId}`;
}

export function CompareChatWorkbench({
  connections,
  defaultModelsByProvider,
  initialHistoryRuns,
  suggestedModelsByProvider,
  user,
}: CompareChatWorkbenchProps) {
  const [prompt, setPrompt] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRuns, setHistoryRuns] =
    useState<CompareRunHistoryRecord[]>(initialHistoryRuns);
  const [runs, setRuns] = useState<CompareRun[]>(() =>
    initialHistoryRuns.map(historyRunToUiRun),
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const run of initialHistoryRuns) {
        for (const target of run.targets) {
          initial[getCardStateKey(`history:${run.id}`, target.targetId)] = true;
        }
      }
      return initial;
    },
  );
  const [selections, setSelections] = useState<ProviderSelection[]>(() =>
    buildInitialSelections(connections, defaultModelsByProvider),
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSelections = useMemo(
    () => selections.filter((selection) => selection.selected),
    [selections],
  );

  const activeConnectionsCount = useMemo(
    () =>
      connections.filter((connection) => connection.status === "active").length,
    [connections],
  );

  const updateRun = (
    runId: string,
    updater: (run: CompareRun) => CompareRun,
  ) => {
    setRuns((prev) =>
      prev.map((run) => (run.id === runId ? updater(run) : run)),
    );
  };

  const applyStreamEventToRun = (runId: string, event: CompareStreamEvent) => {
    updateRun(runId, (run) => applyStreamEvent(run, event));
  };

  const toggleCard = (cardStateKey: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardStateKey]: !(prev[cardStateKey] ?? true),
    }));
  };

  const upsertHistoryRun = (nextHistoryRun: CompareRunHistoryRecord) => {
    setHistoryRuns((prev) => {
      const withoutExisting = prev.filter(
        (item) => item.id !== nextHistoryRun.id,
      );
      return [nextHistoryRun, ...withoutExisting].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  };

  const loadHistoryRunIntoWorkspace = (historyRun: CompareRunHistoryRecord) => {
    const replayRun = cloneHistoryRunIntoWorkspace(historyRun);

    setRuns((prev) => [replayRun, ...prev]);
    setExpandedCards((prev) => {
      const next = { ...prev };
      for (const target of replayRun.targets) {
        next[getCardStateKey(replayRun.id, target.id)] = true;
      }
      return next;
    });
  };

  const persistRunToHistory = async (
    runId: string,
    runSnapshot: CompareRun,
  ) => {
    if (runSnapshot.persistState === "saved" || runSnapshot.historyId) {
      return;
    }

    const payload = buildPersistPayload(runSnapshot);
    if (!payload) {
      return;
    }

    setHistoryError(null);
    updateRun(runId, (run) => ({ ...run, persistState: "saving" }));

    try {
      const response = await fetch("/api/chat/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = (await readResponseError(response)).trim();
        throw new Error(
          message || `Failed to save history (${response.status}).`,
        );
      }

      const json = (await response.json()) as { run?: CompareRunHistoryRecord };
      if (!json.run) {
        throw new Error("History save succeeded but no run was returned.");
      }

      upsertHistoryRun(json.run);
      updateRun(runId, (run) => ({
        ...run,
        historyId: json.run?.id,
        createdAt: json.run?.createdAt ?? run.createdAt,
        persistedAt: json.run?.updatedAt,
        persistState: "saved",
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save run history.";
      setHistoryError(message);
      updateRun(runId, (run) => ({ ...run, persistState: "save_error" }));
    }
  };

  const refreshHistory = async () => {
    setHistoryError(null);

    try {
      const response = await fetch("/api/chat/history?limit=20", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = (await readResponseError(response)).trim();
        throw new Error(
          message || `Failed to load history (${response.status}).`,
        );
      }

      const json = (await response.json()) as {
        runs?: CompareRunHistoryRecord[];
      };
      setHistoryRuns(json.runs ?? []);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Failed to refresh history.",
      );
    }
  };

  const stopActiveStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (!activeRunId) {
      return;
    }

    updateRun(activeRunId, (run) => ({
      ...run,
      status: "aborted",
      error: "Streaming stopped by user.",
      targets: run.targets.map((target) =>
        target.status === "queued" || target.status === "streaming"
          ? {
              ...target,
              status: "error",
              error: "Request aborted.",
            }
          : target,
      ),
    }));
    setActiveRunId(null);
  };

  const submitPrompt = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setGlobalError("Enter a prompt before sending.");
      return;
    }

    if (activeSelections.length === 0) {
      setGlobalError("Select at least one provider connection.");
      return;
    }

    setGlobalError(null);

    const runId = createRunId();
    const createdAt = new Date().toISOString();
    const targets: CompareTargetCard[] = activeSelections.map(
      (selection, index) => ({
        id: `${selection.provider}:${selection.connectionId}:${index}`,
        connectionId: selection.connectionId,
        provider: selection.provider,
        label: selection.label,
        model: selection.model,
        content: "",
        status: "queued",
      }),
    );

    let draftRun: CompareRun = {
      id: runId,
      createdAt,
      prompt: trimmedPrompt,
      status: "streaming",
      persistState: "idle",
      targets,
    };

    setExpandedCards((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        next[getCardStateKey(runId, target.id)] = true;
      }
      return next;
    });

    setRuns((prev) => [draftRun, ...prev]);
    setActiveRunId(runId);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          targets: activeSelections.map((selection) => ({
            connectionId: selection.connectionId,
            provider: selection.provider,
            model: selection.model,
          })),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorMessage = (await readResponseError(response)).trim();
        const message =
          errorMessage || `Request failed with status ${response.status}.`;
        draftRun = {
          ...draftRun,
          status: "error",
          error: message,
          targets: draftRun.targets.map((target) => ({
            ...target,
            status: "error",
            error: target.error ?? message,
          })),
        };
        updateRun(runId, () => draftRun);
        return;
      }

      if (!response.body) {
        throw new Error(
          "The streaming endpoint returned an empty response body.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseFrames(buffer);
        buffer = parsed.rest;

        for (const event of parsed.events) {
          draftRun = applyStreamEvent(draftRun, event);
          applyStreamEventToRun(runId, event);
        }
      }

      const finalParsed = parseSseFrames(buffer + "\n\n");
      for (const event of finalParsed.events) {
        draftRun = applyStreamEvent(draftRun, event);
        applyStreamEventToRun(runId, event);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        draftRun = {
          ...draftRun,
          status: "aborted",
          error: draftRun.error ?? "Streaming stopped by user.",
          targets: draftRun.targets.map((target) =>
            target.status === "queued" || target.status === "streaming"
              ? {
                  ...target,
                  status: "error",
                  error: target.error ?? "Request aborted.",
                }
              : target,
          ),
        };
        updateRun(runId, () => draftRun);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to stream compare results.";
      draftRun = {
        ...draftRun,
        status: "error",
        error: message,
        targets: draftRun.targets.map((target) =>
          target.status === "queued" || target.status === "streaming"
            ? {
                ...target,
                status: "error",
                error: message,
              }
            : target,
        ),
      };
      updateRun(runId, () => draftRun);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setActiveRunId((current) => (current === runId ? null : current));

      await persistRunToHistory(runId, draftRun);
    }
  };

  const activeRun = activeRunId
    ? runs.find((run) => run.id === activeRunId)
    : null;

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-gradient-to-r from-amber-50 via-white to-teal-50 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
                Compare Chat
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
                Prompt once, compare answers as they stream in
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Phase 6 persists compare runs and restores history after
                refresh.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-xs text-zinc-600 backdrop-blur">
              <div>
                Signed in as{" "}
                <span className="font-medium text-zinc-900">
                  {user.email ?? user.id}
                </span>
              </div>
              <div className="mt-1">
                Active connections:{" "}
                <span className="font-medium text-zinc-900">
                  {activeConnectionsCount}
                </span>
              </div>
              <div className="mt-1">
                Saved runs:{" "}
                <span className="font-medium text-zinc-900">
                  {historyRuns.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
                  Model targets
                </h3>
                <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                  {activeSelections.length} selected
                </span>
              </div>

              {selections.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                  No provider connections found yet. Add API keys in{" "}
                  <Link
                    href="/app/providers"
                    className="font-medium text-zinc-900 underline underline-offset-4"
                  >
                    Provider Settings
                  </Link>{" "}
                  before starting a comparison.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selections.map((selection) => {
                    const datalistId = `models-${selection.provider}`;

                    return (
                      <div
                        key={selection.connectionId}
                        className="rounded-xl border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selection.selected}
                            onChange={(event) =>
                              setSelections((prev) =>
                                prev.map((item) =>
                                  item.connectionId === selection.connectionId
                                    ? {
                                        ...item,
                                        selected: event.target.checked,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="mt-1 size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900">
                                {selection.label}
                              </span>
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                                {PROVIDER_LABELS[selection.provider]}
                              </span>
                            </div>

                            <label className="mt-3 block text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">
                              Model
                            </label>
                            <input
                              list={datalistId}
                              value={selection.model}
                              onChange={(event) =>
                                setSelections((prev) =>
                                  prev.map((item) =>
                                    item.connectionId === selection.connectionId
                                      ? { ...item, model: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
                              disabled={!selection.selected}
                              placeholder={
                                defaultModelsByProvider[selection.provider]
                              }
                            />
                            <datalist id={datalistId}>
                              {suggestedModelsByProvider[
                                selection.provider
                              ].map((model) => (
                                <option key={model} value={model} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
                  Prompt composer
                </h3>
                {activeRun ? (
                  <span className="text-xs tracking-[0.18em] text-amber-600 uppercase">
                    Streaming
                  </span>
                ) : null}
              </div>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask a question or paste a prompt to compare responses across models..."
                className="mt-3 min-h-36 w-full resize-y rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-900 ring-0 outline-none placeholder:text-zinc-400 focus:border-zinc-500"
              />

              {globalError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {globalError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-zinc-500">
                  Completed/failed runs are saved automatically to history.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrompt("")}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Clear
                  </button>

                  {activeRun ? (
                    <button
                      type="button"
                      onClick={stopActiveStream}
                      className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitPrompt}
                      disabled={
                        activeSelections.length === 0 ||
                        prompt.trim().length === 0
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send to {Math.max(activeSelections.length, 1)} model
                      {activeSelections.length === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
                  Saved history
                </h3>
                <button
                  type="button"
                  onClick={refreshHistory}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Refresh
                </button>
              </div>

              {historyError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {historyError}
                </div>
              ) : null}

              {historyRuns.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">
                  No saved compare runs yet. Send a prompt to create one.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {historyRuns.map((historyRun) => (
                    <div
                      key={historyRun.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-zinc-900">
                            {historyRun.prompt}
                          </p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {new Date(historyRun.createdAt).toLocaleString(
                              undefined,
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {historyRun.targets.map((target) => (
                              <span
                                key={`${historyRun.id}-${target.id}`}
                                className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] tracking-[0.12em] text-zinc-500 uppercase"
                              >
                                {PROVIDER_LABELS[target.provider]}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            loadHistoryRunIntoWorkspace(historyRun)
                          }
                          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-5">
            {runs.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                  No comparisons yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Select one or more provider connections, enter a prompt, and
                  start streaming results.
                </p>
              </section>
            ) : (
              runs.map((run) => (
                <section
                  key={run.id}
                  className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="border-b border-zinc-200 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                            Prompt
                          </p>
                          {run.historyId ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-emerald-700 uppercase">
                              Saved
                            </span>
                          ) : run.persistState === "saving" ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-amber-700 uppercase">
                              Saving
                            </span>
                          ) : run.persistState === "save_error" ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-red-700 uppercase">
                              Save failed
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-zinc-900">
                          {run.prompt}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        <div>
                          {new Date(run.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                        <div className="mt-1 tracking-[0.14em] uppercase">
                          Status: {run.status}
                        </div>
                      </div>
                    </div>

                    {run.error ? (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {run.error}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 p-5 xl:grid-cols-2">
                    {run.targets.map((target) => {
                      const cardStateKey = getCardStateKey(run.id, target.id);
                      const isExpanded = expandedCards[cardStateKey] ?? true;

                      return (
                        <article
                          key={`${run.id}-${target.id}`}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCard(cardStateKey)}
                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-block size-2 rounded-full ${providerDotClass(target.status)}`}
                                />
                                <span className="text-sm font-semibold text-zinc-900">
                                  {target.label}
                                </span>
                                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                                  {PROVIDER_LABELS[target.provider]}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-600">
                                {target.model}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-600">
                              <span className="tracking-[0.14em] uppercase">
                                {target.status}
                              </span>
                              <span aria-hidden>
                                {isExpanded ? "Hide" : "Show"}
                              </span>
                            </div>
                          </button>

                          {isExpanded ? (
                            <div className="border-t border-zinc-200 bg-white px-4 py-3">
                              {target.error ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  {target.error}
                                </div>
                              ) : null}

                              {target.content ? (
                                <pre className="mt-0 text-sm leading-6 break-words whitespace-pre-wrap text-zinc-900">
                                  {target.content}
                                </pre>
                              ) : target.status === "queued" ? (
                                <p className="text-sm text-zinc-500">
                                  Waiting to start...
                                </p>
                              ) : target.status === "streaming" ? (
                                <p className="text-sm text-zinc-500">
                                  Streaming response...
                                </p>
                              ) : (
                                <p className="text-sm text-zinc-500">
                                  No content returned.
                                </p>
                              )}

                              {target.finishReason ? (
                                <p className="mt-3 text-xs tracking-[0.14em] text-zinc-500 uppercase">
                                  Finish reason: {target.finishReason}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
