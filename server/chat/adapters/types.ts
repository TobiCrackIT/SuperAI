import type { ProviderId } from "@/types/providers";

export type ModelStreamChunk =
  | { type: "delta"; delta: string }
  | { type: "done"; finishReason?: string };

export type ModelStreamTarget = {
  apiKey: string;
  label: string;
  model: string;
  prompt: string;
  provider: ProviderId;
  signal?: AbortSignal;
  targetId: string;
};

export type ModelAdapter = {
  provider: ProviderId;
  streamText(target: ModelStreamTarget): AsyncGenerator<ModelStreamChunk>;
};
