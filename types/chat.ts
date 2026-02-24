import { z } from "zod";
import { isProviderId, type ProviderId } from "@/types/providers";

export const compareChatTargetSchema = z.object({
  provider: z.string().refine(isProviderId, "Unsupported provider."),
  model: z.string().trim().min(1),
  connectionId: z.string().uuid().optional(),
});

export const compareChatRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
  targets: z.array(compareChatTargetSchema).min(1).max(12),
});

export type CompareChatTargetInput = z.infer<typeof compareChatTargetSchema> & {
  provider: ProviderId;
};

export type CompareChatRequestInput = z.infer<
  typeof compareChatRequestSchema
> & {
  targets: CompareChatTargetInput[];
};

export type CompareStreamEvent =
  | {
      requestId: string;
      timestamp: string;
      type: "session_started";
      targetCount: number;
    }
  | {
      provider: ProviderId;
      requestId: string;
      targetId: string;
      timestamp: string;
      type: "target_started";
      model: string;
      label: string;
    }
  | {
      provider: ProviderId;
      requestId: string;
      targetId: string;
      timestamp: string;
      type: "target_chunk";
      model: string;
      delta: string;
    }
  | {
      provider: ProviderId;
      requestId: string;
      targetId: string;
      timestamp: string;
      type: "target_done";
      model: string;
      finishReason?: string;
    }
  | {
      provider: ProviderId;
      requestId: string;
      targetId: string;
      timestamp: string;
      type: "target_error";
      model: string;
      error: string;
    }
  | {
      requestId: string;
      timestamp: string;
      type: "session_complete";
    };

export const persistedCompareTargetSchema = z.object({
  connectionId: z.string().uuid().nullable().optional(),
  connectionLabel: z.string().trim().min(1).max(128),
  content: z.string(),
  error: z.string().optional(),
  finishReason: z.string().optional(),
  model: z.string().trim().min(1),
  provider: z.string().refine(isProviderId, "Unsupported provider."),
  status: z.enum(["queued", "streaming", "done", "error"]),
  targetId: z.string().trim().min(1),
});

export const persistCompareRunRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000),
  requestId: z.string().trim().min(1).optional(),
  sessionError: z.string().optional(),
  status: z.enum(["complete", "error", "aborted"]),
  targets: z.array(persistedCompareTargetSchema).min(1).max(12),
});

export type PersistedCompareTarget = z.infer<
  typeof persistedCompareTargetSchema
> & {
  provider: ProviderId;
};

export type PersistCompareRunRequest = z.infer<
  typeof persistCompareRunRequestSchema
> & {
  targets: PersistedCompareTarget[];
};

export type CompareRunHistoryTarget = {
  connectionId: string | null;
  connectionLabel: string;
  content: string;
  error: string | null;
  finishReason: string | null;
  id: string;
  model: string;
  provider: ProviderId;
  sortOrder: number;
  status: "queued" | "streaming" | "done" | "error";
  targetId: string;
};

export type CompareRunHistoryRecord = {
  createdAt: string;
  id: string;
  prompt: string;
  requestId: string | null;
  sessionError: string | null;
  status: "complete" | "error" | "aborted";
  targets: CompareRunHistoryTarget[];
  updatedAt: string;
};
