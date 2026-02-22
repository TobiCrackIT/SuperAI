"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { CompareStreamEvent } from "@/types/chat";
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
  connectionId: string;
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
  id: string;
  prompt: string;
  requestId?: string;
  status: "streaming" | "complete" | "error" | "aborted";
  targets: CompareTargetCard[];
};

type CompareChatWorkbenchProps = {
  connections: ProviderConnectionSummary[];
  defaultModelsByProvider: DefaultModelCatalog;
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

export function CompareChatWorkbench({
  connections,
  defaultModelsByProvider,
  suggestedModelsByProvider,
  user,
}: CompareChatWorkbenchProps) {
  const [prompt, setPrompt] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [runs, setRuns] = useState<CompareRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {},
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

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !(prev[cardId] ?? true),
    }));
  };

  const updateRun = (
    runId: string,
    updater: (run: CompareRun) => CompareRun,
  ) => {
    setRuns((prev) =>
      prev.map((run) => (run.id === runId ? updater(run) : run)),
    );
  };

  const applyStreamEventToRun = (runId: string, event: CompareStreamEvent) => {
    updateRun(runId, (run) => {
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
    });
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
    const targets = activeSelections.map((selection, index) => ({
      id: `${selection.provider}:${selection.connectionId}:${index}`,
      connectionId: selection.connectionId,
      provider: selection.provider,
      label: selection.label,
      model: selection.model,
      content: "",
      status: "queued" as const,
    }));

    setExpandedCards((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        next[target.id] = true;
      }
      return next;
    });

    setRuns((prev) => [
      {
        id: runId,
        createdAt,
        prompt: trimmedPrompt,
        status: "streaming",
        targets,
      },
      ...prev,
    ]);

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
        updateRun(runId, (run) => ({
          ...run,
          status: "error",
          error:
            errorMessage || `Request failed with status ${response.status}.`,
          targets: run.targets.map((target) => ({
            ...target,
            status: "error",
            error:
              target.error ??
              (errorMessage ||
                `Request failed with status ${response.status}.`),
          })),
        }));
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
          applyStreamEventToRun(runId, event);
        }
      }

      const finalParsed = parseSseFrames(buffer + "\n\n");
      for (const event of finalParsed.events) {
        applyStreamEventToRun(runId, event);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateRun(runId, (run) => ({
          ...run,
          status: run.status === "complete" ? "complete" : "aborted",
        }));
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to stream compare results.";
      updateRun(runId, (run) => ({
        ...run,
        status: "error",
        error: message,
        targets: run.targets.map((target) =>
          target.status === "queued" || target.status === "streaming"
            ? {
                ...target,
                status: "error",
                error: message,
              }
            : target,
        ),
      }));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setActiveRunId((current) => (current === runId ? null : current));
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
                Select connected models, send a prompt, and watch each response
                render in its own expandable card.
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
                  The response stream is neutral and side-by-side. No automatic
                  ranking is applied.
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
                        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                          Prompt
                        </p>
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
                      const isExpanded = expandedCards[target.id] ?? true;

                      return (
                        <article
                          key={target.id}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCard(target.id)}
                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-block size-2 rounded-full ${providerDotClass(
                                    target.status,
                                  )}`}
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
