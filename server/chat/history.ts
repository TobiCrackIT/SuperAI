import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  CompareRunHistoryRecord,
  CompareRunHistoryTarget,
  PersistCompareRunRequest,
} from "@/types/chat";
import type { ProviderId } from "@/types/providers";

type CompareRunRow = {
  created_at: string;
  id: string;
  prompt: string;
  request_id: string | null;
  session_error: string | null;
  status: "complete" | "error" | "aborted";
  updated_at: string;
  user_id: string;
};

type CompareRunTargetRow = {
  compare_run_id: string;
  connection_id: string | null;
  connection_label: string;
  content: string;
  error: string | null;
  finish_reason: string | null;
  id: string;
  model: string;
  provider: ProviderId;
  sort_order: number;
  status: "queued" | "streaming" | "done" | "error";
  target_id: string;
  user_id: string;
};

async function getAuthContextOrThrow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

function mapTargetRow(row: CompareRunTargetRow): CompareRunHistoryTarget {
  return {
    id: row.id,
    targetId: row.target_id,
    provider: row.provider,
    connectionId: row.connection_id,
    connectionLabel: row.connection_label,
    model: row.model,
    status: row.status,
    content: row.content,
    error: row.error,
    finishReason: row.finish_reason,
    sortOrder: row.sort_order,
  };
}

function mapRunRow(
  runRow: CompareRunRow,
  targetRows: CompareRunTargetRow[],
): CompareRunHistoryRecord {
  return {
    id: runRow.id,
    prompt: runRow.prompt,
    requestId: runRow.request_id,
    status: runRow.status,
    sessionError: runRow.session_error,
    createdAt: runRow.created_at,
    updatedAt: runRow.updated_at,
    targets: targetRows
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapTargetRow),
  };
}

const historyIdSchema = z.string().uuid();

export async function createCompareRunHistory(
  input: PersistCompareRunRequest,
): Promise<CompareRunHistoryRecord> {
  const { supabase, user } = await getAuthContextOrThrow();

  const { data: insertedRun, error: runInsertError } = await supabase
    .from("compare_runs")
    .insert({
      user_id: user.id,
      request_id: input.requestId ?? null,
      prompt: input.prompt,
      status: input.status,
      session_error: input.sessionError ?? null,
    })
    .select(
      "id, user_id, request_id, prompt, status, session_error, created_at, updated_at",
    )
    .single();

  if (runInsertError) {
    throw new Error(runInsertError.message);
  }

  const runRow = insertedRun as CompareRunRow;

  const targetRowsToInsert = input.targets.map((target, index) => ({
    compare_run_id: runRow.id,
    user_id: user.id,
    target_id: target.targetId,
    provider: target.provider,
    connection_id: target.connectionId ?? null,
    connection_label: target.connectionLabel,
    model: target.model,
    status: target.status,
    content: target.content,
    error: target.error ?? null,
    finish_reason: target.finishReason ?? null,
    sort_order: index,
  }));

  const { data: insertedTargets, error: targetInsertError } = await supabase
    .from("compare_run_targets")
    .insert(targetRowsToInsert)
    .select(
      "id, user_id, compare_run_id, target_id, provider, connection_id, connection_label, model, status, content, error, finish_reason, sort_order",
    );

  if (targetInsertError) {
    await supabase
      .from("compare_runs")
      .delete()
      .eq("id", runRow.id)
      .eq("user_id", user.id);
    throw new Error(targetInsertError.message);
  }

  return mapRunRow(runRow, (insertedTargets ?? []) as CompareRunTargetRow[]);
}

export async function listCompareRunHistory(
  limit = 12,
): Promise<CompareRunHistoryRecord[]> {
  const { supabase, user } = await getAuthContextOrThrow();
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const { data: runRows, error: runsError } = await supabase
    .from("compare_runs")
    .select(
      "id, user_id, request_id, prompt, status, session_error, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (runsError) {
    throw new Error(runsError.message);
  }

  const runs = (runRows ?? []) as CompareRunRow[];

  if (runs.length === 0) {
    return [];
  }

  const runIds = runs.map((run) => run.id);

  const { data: targetRows, error: targetsError } = await supabase
    .from("compare_run_targets")
    .select(
      "id, user_id, compare_run_id, target_id, provider, connection_id, connection_label, model, status, content, error, finish_reason, sort_order",
    )
    .eq("user_id", user.id)
    .in("compare_run_id", runIds)
    .order("sort_order", { ascending: true });

  if (targetsError) {
    throw new Error(targetsError.message);
  }

  const targetsByRunId = new Map<string, CompareRunTargetRow[]>();
  for (const row of (targetRows ?? []) as CompareRunTargetRow[]) {
    const list = targetsByRunId.get(row.compare_run_id) ?? [];
    list.push(row);
    targetsByRunId.set(row.compare_run_id, list);
  }

  return runs.map((run) => mapRunRow(run, targetsByRunId.get(run.id) ?? []));
}

export async function getCompareRunHistoryById(
  id: string,
): Promise<CompareRunHistoryRecord> {
  const compareRunId = historyIdSchema.parse(id);
  const { supabase, user } = await getAuthContextOrThrow();

  const { data: runRow, error: runError } = await supabase
    .from("compare_runs")
    .select(
      "id, user_id, request_id, prompt, status, session_error, created_at, updated_at",
    )
    .eq("id", compareRunId)
    .eq("user_id", user.id)
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const { data: targetRows, error: targetError } = await supabase
    .from("compare_run_targets")
    .select(
      "id, user_id, compare_run_id, target_id, provider, connection_id, connection_label, model, status, content, error, finish_reason, sort_order",
    )
    .eq("compare_run_id", compareRunId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (targetError) {
    throw new Error(targetError.message);
  }

  return mapRunRow(
    runRow as CompareRunRow,
    (targetRows ?? []) as CompareRunTargetRow[],
  );
}
