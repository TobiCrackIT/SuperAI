"use server";

import { redirect } from "next/navigation";
import { hasProviderSecretsEncryptionKey } from "@/lib/env";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import {
  createProviderConnection,
  deleteProviderConnection,
  updateProviderConnection,
} from "@/server/providers/connections";
import { isProviderId } from "@/types/providers";

const providersPath = "/app/providers";

function toStringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithParams(params: Record<string, string>): never {
  const url = new URL(providersPath, "http://localhost:3000");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  redirect(url.pathname + url.search);
}

function ensureProviderManagementConfigured() {
  if (!hasSupabasePublicConfig()) {
    throw new Error("Supabase is not configured yet.");
  }

  if (!hasProviderSecretsEncryptionKey()) {
    throw new Error(
      "Provider secret encryption key is not configured. Set PROVIDER_SECRETS_ENCRYPTION_KEY.",
    );
  }
}

export async function createProviderConnectionAction(formData: FormData) {
  let params: Record<string, string>;

  try {
    ensureProviderManagementConfigured();
    await createProviderConnection({
      provider: toStringValue(formData, "provider"),
      label: toStringValue(formData, "label"),
      apiKey: toStringValue(formData, "apiKey"),
    });
    params = { message: "Provider connection saved successfully." };
  } catch (error) {
    params = {
      error:
        error instanceof Error
          ? error.message
          : "Failed to save provider connection.",
    };
  }

  redirectWithParams(params);
}

export async function updateProviderConnectionAction(formData: FormData) {
  const provider = toStringValue(formData, "provider");
  let params: Record<string, string>;

  try {
    ensureProviderManagementConfigured();

    if (!isProviderId(provider)) {
      throw new Error("Unsupported provider.");
    }

    await updateProviderConnection(provider, {
      id: toStringValue(formData, "id"),
      label: toStringValue(formData, "label"),
      apiKey: toStringValue(formData, "apiKey") || undefined,
    });
    params = { message: "Provider connection updated." };
  } catch (error) {
    params = {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update provider connection.",
    };
  }

  redirectWithParams(params);
}

export async function deleteProviderConnectionAction(formData: FormData) {
  let params: Record<string, string>;

  try {
    ensureProviderManagementConfigured();
    await deleteProviderConnection(toStringValue(formData, "id"));
    params = { message: "Provider connection removed." };
  } catch (error) {
    params = {
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove provider connection.",
    };
  }

  redirectWithParams(params);
}
