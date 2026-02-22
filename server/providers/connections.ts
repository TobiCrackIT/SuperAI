import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, maskSecret } from "@/server/providers/crypto";
import {
  providerConnectionInputSchema,
  validateProviderCredentials,
} from "@/server/providers/validators";
import type { ProviderId } from "@/types/providers";

const providerConnectionUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(64),
  apiKey: z.string().trim().optional(),
});

export type ProviderConnectionRow = {
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
  api_key_mask: string;
};

export type ProviderConnectionSecretRow = ProviderConnectionRow & {
  encrypted_api_key: string;
};

export async function getAuthenticatedUserOrThrow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function listProviderConnections(): Promise<
  ProviderConnectionRow[]
> {
  const { supabase, user } = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from("provider_connections")
    .select(
      "id, user_id, provider, label, api_key_mask, status, last_validated_at, last_validation_status, last_validation_message, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProviderConnectionRow[];
}

export async function listProviderConnectionsWithSecrets(): Promise<
  ProviderConnectionSecretRow[]
> {
  const { supabase, user } = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from("provider_connections")
    .select(
      "id, user_id, provider, label, encrypted_api_key, api_key_mask, status, last_validated_at, last_validation_status, last_validation_message, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProviderConnectionSecretRow[];
}

export async function createProviderConnection(input: unknown) {
  const parsed = providerConnectionInputSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUserOrThrow();

  const validation = await validateProviderCredentials(
    parsed.provider as ProviderId,
    parsed.apiKey,
  );

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const encryptedApiKey = encryptSecret(parsed.apiKey);

  const { data, error } = await supabase
    .from("provider_connections")
    .insert({
      user_id: user.id,
      provider: parsed.provider,
      label: parsed.label,
      encrypted_api_key: encryptedApiKey,
      api_key_mask: maskSecret(parsed.apiKey),
      status: "active",
      last_validated_at: new Date().toISOString(),
      last_validation_status: "success",
      last_validation_message: validation.message,
    })
    .select(
      "id, user_id, provider, label, api_key_mask, status, last_validated_at, last_validation_status, last_validation_message, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProviderConnectionRow;
}

export async function updateProviderConnection(
  provider: ProviderId,
  input: unknown,
) {
  const parsed = providerConnectionUpdateSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUserOrThrow();

  const updateData: Record<string, string | null> = {
    label: parsed.label,
  };

  if (parsed.apiKey && parsed.apiKey.length > 0) {
    const validation = await validateProviderCredentials(
      provider,
      parsed.apiKey,
    );

    if (!validation.ok) {
      throw new Error(validation.message);
    }

    updateData.encrypted_api_key = encryptSecret(parsed.apiKey);
    updateData.api_key_mask = maskSecret(parsed.apiKey);
    updateData.last_validated_at = new Date().toISOString();
    updateData.last_validation_status = "success";
    updateData.last_validation_message = validation.message;
    updateData.status = "active";
  }

  const { data, error } = await supabase
    .from("provider_connections")
    .update(updateData)
    .eq("id", parsed.id)
    .eq("user_id", user.id)
    .eq("provider", provider)
    .select(
      "id, user_id, provider, label, api_key_mask, status, last_validated_at, last_validation_status, last_validation_message, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProviderConnectionRow;
}

export async function deleteProviderConnection(id: string) {
  const parsedId = z.string().uuid().parse(id);
  const { supabase, user } = await getAuthenticatedUserOrThrow();

  const { error } = await supabase
    .from("provider_connections")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
