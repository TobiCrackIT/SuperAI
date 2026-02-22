import { z } from "zod";
import { isProviderId, type ProviderId } from "@/types/providers";

const timeoutMs = 10_000;

export const providerConnectionInputSchema = z.object({
  provider: z.string().refine(isProviderId, "Unsupported provider."),
  label: z.string().trim().min(1).max(64),
  apiKey: z.string().trim().min(1),
});

export const providerValidateInputSchema = z.object({
  provider: z.string().refine(isProviderId, "Unsupported provider."),
  apiKey: z.string().trim().min(1),
});

type ValidationResult = {
  message: string;
  ok: boolean;
  provider: ProviderId;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildValidationMessage(provider: ProviderId, status: number): string {
  if (status >= 200 && status < 300) {
    return `${provider} credentials are valid.`;
  }

  if (status === 401 || status === 403) {
    return `${provider} credentials were rejected.`;
  }

  return `${provider} validation returned status ${status}.`;
}

export async function validateProviderCredentials(
  provider: ProviderId,
  apiKey: string,
): Promise<ValidationResult> {
  let response: Response;

  try {
    switch (provider) {
      case "openai":
        response = await fetchWithTimeout("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        break;
      case "anthropic":
        response = await fetchWithTimeout(
          "https://api.anthropic.com/v1/models",
          {
            headers: {
              "anthropic-version": "2023-06-01",
              "x-api-key": apiKey,
            },
          },
        );
        break;
      case "google":
        response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
            apiKey,
          )}`,
        );
        break;
      default:
        return {
          ok: false,
          provider,
          message: "Unsupported provider.",
        };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error.";

    return {
      ok: false,
      provider,
      message: `Unable to validate ${provider} credentials: ${message}`,
    };
  }

  return {
    ok: response.ok,
    provider,
    message: buildValidationMessage(provider, response.status),
  };
}
