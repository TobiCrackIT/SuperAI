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
