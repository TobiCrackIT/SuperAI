export const PROVIDERS = ["openai", "anthropic", "google"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export type ProviderConnectionSummary = {
  api_key_mask: string;
  created_at: string;
  id: string;
  label: string;
  last_validation_message: string | null;
  last_validation_status: string | null;
  last_validated_at: string | null;
  provider: ProviderId;
  status: string;
  updated_at: string;
  user_id: string;
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.includes(value as ProviderId);
}
