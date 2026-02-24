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
  appName: string;
  connections: ProviderConnectionSummary[];
  connectionsLoadError: string | null;
  defaultModelsByProvider: DefaultModelCatalog;
  hasEncryptionKey: boolean;
  historyLoadError: string | null;
  initialHistoryRuns: CompareRunHistoryRecord[];
  signOutAction: () => Promise<void>;
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
      return "bg-emerald-400";
    case "error":
      return "bg-rose-400";
    case "streaming":
      return "bg-amber-300";
    default:
      return "bg-zinc-500";
  }
}

function runStatusPillClass(status: CompareRun["status"]): string {
  switch (status) {
    case "complete":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "streaming":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "aborted":
      return "border-zinc-400/30 bg-zinc-400/10 text-zinc-200";
    case "error":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-zinc-400/30 bg-zinc-400/10 text-zinc-200";
  }
}

function persistPillClass(state: CompareRun["persistState"]): string {
  switch (state) {
    case "saved":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "saving":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "save_error":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "hidden";
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

function formatDateLabel(input: string): string {
  return new Date(input).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SidebarIcon({ children }: { children: string }) {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-zinc-200">
      {children}
    </span>
  );
}

export function CompareChatWorkbench({
  appName,
  connections,
  connectionsLoadError,
  defaultModelsByProvider,
  hasEncryptionKey,
  historyLoadError,
  initialHistoryRuns,
  signOutAction,
  suggestedModelsByProvider,
  user,
}: CompareChatWorkbenchProps) {
  const [prompt, setPrompt] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(
    historyLoadError,
  );
  const [historyRuns, setHistoryRuns] =
    useState<CompareRunHistoryRecord[]>(initialHistoryRuns);
  const [runs, setRuns] = useState<CompareRun[]>(() =>
    initialHistoryRuns.map(historyRunToUiRun),
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    setPrompt(historyRun.prompt);
    setRuns((prev) => [replayRun, ...prev]);
    setExpandedCards((prev) => {
      const next = { ...prev };
      for (const target of replayRun.targets) {
        next[getCardStateKey(replayRun.id, target.id)] = true;
      }
      return next;
    });
    setSidebarOpen(false);
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
      setGlobalError("Select at least one provider connection in the sidebar.");
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
  const hasRuns = runs.length > 0;

  const renderComposer = (variant: "hero" | "dock") => {
    const isHero = variant === "hero";

    return (
      <div
        className={[
          "rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur",
          isHero ? "w-full max-w-4xl" : "w-full",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-xs text-zinc-400">
          <button
            type="button"
            onClick={() => setPrompt("")}
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-base transition hover:bg-white/[0.07]"
            aria-label="Clear prompt"
          >
            +
          </button>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 tracking-[0.14em] uppercase">
            {activeSelections.length} target
            {activeSelections.length === 1 ? "" : "s"}
          </span>
          {activeRun ? (
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 tracking-[0.14em] text-amber-100 uppercase">
              Streaming
            </span>
          ) : null}
          <span className="ml-auto hidden sm:block">
            Press Enter to compare
          </span>
        </div>

        <div className="flex items-end gap-2 px-3 py-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!activeRun) {
                  void submitPrompt();
                }
              }
            }}
            placeholder="Ask anything across multiple models..."
            className="min-h-[60px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-500"
          />

          <div className="flex items-center gap-2 pb-1">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08]"
              aria-label="Voice input placeholder"
              title="Voice input (coming soon)"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 1 0 6 0V7a3 3 0 0 0-3-3Z" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </button>

            {activeRun ? (
              <button
                type="button"
                onClick={stopActiveStream}
                className="inline-flex size-10 items-center justify-center rounded-full border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/20"
                aria-label="Stop streaming"
              >
                <span className="block size-3 rounded-sm bg-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submitPrompt()}
                disabled={
                  activeSelections.length === 0 || prompt.trim().length === 0
                }
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                Compare
              </button>
            )}
          </div>
        </div>

        {globalError ? (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
              {globalError}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1115] shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(103,232,249,0.05),transparent_35%),radial-gradient(circle_at_60%_70%,rgba(250,204,21,0.04),transparent_30%)]" />

      <div className="relative flex h-[calc(100vh-1rem)] min-h-[720px]">
        {sidebarOpen ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-20 bg-black/50 lg:hidden"
            aria-label="Close sidebar"
          />
        ) : null}

        <aside
          className={[
            "absolute inset-y-0 left-0 z-30 flex w-[300px] shrink-0 flex-col border-r border-white/10 bg-[#0a0b0e]/95 backdrop-blur-xl transition lg:static lg:z-0 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white text-sm font-semibold text-zinc-900">
                S
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{appName}</p>
                <p className="text-xs text-zinc-500">Compare workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.08] lg:hidden"
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>

          <div className="px-3">
            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setGlobalError(null);
                setSidebarOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-zinc-100 transition hover:bg-white/[0.07]"
            >
              <SidebarIcon>✎</SidebarIcon>
              <span>New compare</span>
            </button>
          </div>

          <nav className="mt-4 px-3 text-sm text-zinc-300">
            <div className="space-y-1">
              <Link
                href="/app/providers"
                className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/[0.05]"
                onClick={() => setSidebarOpen(false)}
              >
                <SidebarIcon>◈</SidebarIcon>
                <span>Provider settings</span>
              </Link>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.05]"
              >
                <SidebarIcon>↻</SidebarIcon>
                <span>Refresh history</span>
              </button>
            </div>
          </nav>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase">
                  Compare targets
                </h3>
                <span className="text-xs text-zinc-500">
                  {activeSelections.length}
                </span>
              </div>

              {connectionsLoadError ? (
                <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">
                  {connectionsLoadError}
                </div>
              ) : null}

              {!hasEncryptionKey ? (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  Add <code>PROVIDER_SECRETS_ENCRYPTION_KEY</code> to enable
                  saved-key retrieval.
                </div>
              ) : null}

              {selections.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
                  No provider connections yet. Add keys in Provider Settings.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {selections.map((selection) => {
                    const datalistId = `sidebar-models-${selection.provider}-${selection.connectionId}`;

                    return (
                      <div
                        key={selection.connectionId}
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex items-start gap-2">
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
                            className="mt-1 size-4 rounded border-zinc-500 bg-transparent text-zinc-100"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-zinc-100">
                                {selection.label}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
                                {PROVIDER_LABELS[selection.provider]}
                              </span>
                            </div>
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
                              disabled={!selection.selected}
                              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase">
                  Saved comparisons
                </h3>
                <span className="text-xs text-zinc-500">
                  {historyRuns.length}
                </span>
              </div>

              {historyError ? (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  {historyError}
                </div>
              ) : null}

              {historyRuns.length === 0 ? (
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  Completed compare runs will appear here and can be loaded back
                  into the workspace.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {historyRuns.map((historyRun) => (
                    <button
                      key={historyRun.id}
                      type="button"
                      onClick={() => loadHistoryRunIntoWorkspace(historyRun)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="line-clamp-2 text-sm text-zinc-100">
                        {historyRun.prompt}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span>{formatDateLabel(historyRun.createdAt)}</span>
                        <span>•</span>
                        <span className="tracking-[0.14em] uppercase">
                          {historyRun.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="truncate text-sm text-zinc-100">
                {user.email ?? user.id}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">Signed in</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-[#111318]">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-200 transition hover:bg-white/[0.08] lg:hidden"
                aria-label="Open sidebar"
              >
                ☰
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100"
              >
                <span className="truncate">SuperAI Compare</span>
                <span className="text-zinc-500">▾</span>
              </button>
            </div>

            <div className="hidden items-center gap-2 text-xs text-zinc-400 md:flex">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 tracking-[0.14em] uppercase">
                {activeSelections.length} targets active
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 tracking-[0.14em] uppercase">
                /api/chat/stream
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/app/providers"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Providers
              </Link>
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-zinc-200">
                {(user.email ?? user.id).slice(0, 2).toUpperCase()}
              </span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {connectionsLoadError || historyError || !hasEncryptionKey ? (
                <div className="mb-4 space-y-2">
                  {connectionsLoadError ? (
                    <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                      Provider connections could not be loaded:{" "}
                      {connectionsLoadError}
                    </div>
                  ) : null}
                  {historyError ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                      Compare history could not be loaded: {historyError}
                    </div>
                  ) : null}
                  {!hasEncryptionKey ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                      Add <code>PROVIDER_SECRETS_ENCRYPTION_KEY</code> to stream
                      using saved provider connections.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!hasRuns ? (
                <div className="flex min-h-full flex-col items-center justify-center px-2 py-8">
                  <div className="text-center">
                    <p className="text-xs tracking-[0.22em] text-zinc-500 uppercase">
                      Multi-model compare workspace
                    </p>
                    <h2 className="mt-4 text-4xl font-medium tracking-tight text-zinc-100 sm:text-5xl">
                      Ready when you are.
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                      Ask once and compare streaming responses from OpenAI,
                      Anthropic, and Gemini side by side.
                    </p>
                  </div>

                  <div className="mt-8 w-full">{renderComposer("hero")}</div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-6xl space-y-5">
                  {runs.map((run) => (
                    <section
                      key={run.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_6px_24px_rgba(0,0,0,0.18)]"
                    >
                      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                                Prompt
                              </span>
                              {run.persistState !== "idle" ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] tracking-[0.14em] uppercase ${persistPillClass(
                                    run.persistState,
                                  )}`}
                                >
                                  {run.persistState === "saved"
                                    ? "Saved"
                                    : run.persistState === "saving"
                                      ? "Saving"
                                      : "Save failed"}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] tracking-[0.14em] uppercase ${runStatusPillClass(
                                  run.status,
                                )}`}
                              >
                                {run.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-zinc-100">
                              {run.prompt}
                            </p>
                          </div>

                          <div className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
                            <div>{formatDateLabel(run.createdAt)}</div>
                            {run.requestId ? (
                              <div className="mt-1 truncate text-[11px] text-zinc-500">
                                {run.requestId}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {run.error ? (
                          <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                            {run.error}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
                        {run.targets.map((target) => {
                          const cardStateKey = getCardStateKey(
                            run.id,
                            target.id,
                          );
                          const isExpanded =
                            expandedCards[cardStateKey] ?? true;

                          return (
                            <article
                              key={`${run.id}-${target.id}`}
                              className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                            >
                              <button
                                type="button"
                                onClick={() => toggleCard(cardStateKey)}
                                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-block size-2 rounded-full ${providerDotClass(
                                        target.status,
                                      )}`}
                                    />
                                    <span className="text-sm font-medium text-zinc-100">
                                      {target.label}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] tracking-[0.12em] text-zinc-400 uppercase">
                                      {PROVIDER_LABELS[target.provider]}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {target.model}
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                                  <span className="tracking-[0.14em] uppercase">
                                    {target.status}
                                  </span>
                                  <span aria-hidden>
                                    {isExpanded ? "Hide" : "Show"}
                                  </span>
                                </div>
                              </button>

                              {isExpanded ? (
                                <div className="border-t border-white/10 bg-[#12151b] px-4 py-3">
                                  {target.error ? (
                                    <div className="mb-3 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                                      {target.error}
                                    </div>
                                  ) : null}

                                  {target.content ? (
                                    <pre className="text-sm leading-6 break-words whitespace-pre-wrap text-zinc-100">
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

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    {target.finishReason ? (
                                      <p className="text-xs tracking-[0.14em] text-zinc-500 uppercase">
                                        Finish reason: {target.finishReason}
                                      </p>
                                    ) : (
                                      <span />
                                    )}
                                    {target.content ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void navigator.clipboard.writeText(
                                            target.content,
                                          )
                                        }
                                        className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08]"
                                      >
                                        Copy
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {hasRuns ? (
              <div className="border-t border-white/10 bg-[#0f1115]/90 px-4 py-4 backdrop-blur sm:px-6">
                <div className="mx-auto w-full max-w-6xl">
                  {renderComposer("dock")}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
