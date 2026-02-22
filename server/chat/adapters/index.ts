import type { ProviderId } from "@/types/providers";
import { anthropicAdapter } from "./anthropic";
import { googleAdapter } from "./google";
import { openAiAdapter } from "./openai";
import type { ModelAdapter } from "./types";

const adapters: Record<ProviderId, ModelAdapter> = {
  openai: openAiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
};

export function getModelAdapter(provider: ProviderId): ModelAdapter {
  return adapters[provider];
}
