export const PROVIDERS = ["openai", "anthropic", "google"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.includes(value as ProviderId);
}
