import type { ProviderId } from "@/types/providers";

export const DEFAULT_MODELS_BY_PROVIDER: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-1.5-flash",
};

export const SUGGESTED_MODELS_BY_PROVIDER: Record<ProviderId, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  anthropic: [
    "claude-3-5-haiku-latest",
    "claude-3-5-sonnet-latest",
    "claude-3-7-sonnet-latest",
  ],
  google: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
};
