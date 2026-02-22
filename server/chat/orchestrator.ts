import { randomUUID } from "node:crypto";
import { getModelAdapter } from "@/server/chat/adapters";
import { DEFAULT_MODELS_BY_PROVIDER } from "@/server/chat/catalog";
import { formatSseEvent } from "@/server/chat/sse";
import {
  compareChatRequestSchema,
  type CompareChatRequestInput,
} from "@/types/chat";
import type { ProviderId } from "@/types/providers";
import { decryptSecret } from "@/server/providers/crypto";
import { listProviderConnectionsWithSecrets } from "@/server/providers/connections";

type ResolvedTarget = {
  apiKey: string;
  connectionId: string;
  label: string;
  model: string;
  provider: ProviderId;
  targetId: string;
};

function nowIso() {
  return new Date().toISOString();
}

function resolveTargets(
  input: CompareChatRequestInput,
  availableConnections: Awaited<
    ReturnType<typeof listProviderConnectionsWithSecrets>
  >,
): ResolvedTarget[] {
  return input.targets.map((target, index) => {
    const matchingConnection = target.connectionId
      ? availableConnections.find(
          (connection) =>
            connection.id === target.connectionId &&
            connection.provider === target.provider,
        )
      : availableConnections.find(
          (connection) => connection.provider === target.provider,
        );

    if (!matchingConnection) {
      throw new Error(
        `No active ${target.provider} provider connection found for target ${index + 1}.`,
      );
    }

    return {
      provider: target.provider,
      model: target.model || DEFAULT_MODELS_BY_PROVIDER[target.provider],
      targetId: `${target.provider}:${matchingConnection.id}:${index}`,
      connectionId: matchingConnection.id,
      label: matchingConnection.label,
      apiKey: decryptSecret(matchingConnection.encrypted_api_key),
    };
  });
}

export async function createCompareChatStream(
  rawInput: unknown,
  options?: { abortSignal?: AbortSignal },
): Promise<{ requestId: string; stream: ReadableStream<Uint8Array> }> {
  const parsed = compareChatRequestSchema.parse(
    rawInput,
  ) as CompareChatRequestInput;
  const providerConnections = await listProviderConnectionsWithSecrets();
  const resolvedTargets = resolveTargets(parsed, providerConnections);
  const requestId = randomUUID();
  const encoder = new TextEncoder();
  const targetAbortControllers = new Map<string, AbortController>();
  let isClosed = false;
  let settledTargets = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Parameters<typeof formatSseEvent>[0]) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(encoder.encode(formatSseEvent(event)));
      };

      const closeIfDone = () => {
        if (isClosed) {
          return;
        }

        if (settledTargets < resolvedTargets.length) {
          return;
        }

        send({
          type: "session_complete",
          requestId,
          timestamp: nowIso(),
        });
        isClosed = true;
        controller.close();
      };

      const abortAll = () => {
        for (const abortController of targetAbortControllers.values()) {
          abortController.abort();
        }
      };

      if (options?.abortSignal) {
        options.abortSignal.addEventListener("abort", abortAll, { once: true });
      }

      send({
        type: "session_started",
        requestId,
        timestamp: nowIso(),
        targetCount: resolvedTargets.length,
      });

      for (const target of resolvedTargets) {
        const adapter = getModelAdapter(target.provider);
        const abortController = new AbortController();
        targetAbortControllers.set(target.targetId, abortController);

        if (options?.abortSignal) {
          options.abortSignal.addEventListener(
            "abort",
            () => abortController.abort(),
            { once: true },
          );
        }

        void (async () => {
          send({
            type: "target_started",
            requestId,
            timestamp: nowIso(),
            targetId: target.targetId,
            provider: target.provider,
            model: target.model,
            label: target.label,
          });

          try {
            for await (const chunk of adapter.streamText({
              apiKey: target.apiKey,
              provider: target.provider,
              model: target.model,
              prompt: parsed.prompt,
              label: target.label,
              targetId: target.targetId,
              signal: abortController.signal,
            })) {
              if (chunk.type === "delta") {
                send({
                  type: "target_chunk",
                  requestId,
                  timestamp: nowIso(),
                  targetId: target.targetId,
                  provider: target.provider,
                  model: target.model,
                  delta: chunk.delta,
                });
                continue;
              }

              send({
                type: "target_done",
                requestId,
                timestamp: nowIso(),
                targetId: target.targetId,
                provider: target.provider,
                model: target.model,
                finishReason: chunk.finishReason,
              });
            }
          } catch (error) {
            const message =
              error instanceof Error
                ? error.name === "AbortError"
                  ? "Request aborted."
                  : error.message
                : "Unknown provider streaming error.";

            send({
              type: "target_error",
              requestId,
              timestamp: nowIso(),
              targetId: target.targetId,
              provider: target.provider,
              model: target.model,
              error: message,
            });
          } finally {
            settledTargets += 1;
            closeIfDone();
          }
        })();
      }
    },
    cancel() {
      isClosed = true;
      for (const abortController of targetAbortControllers.values()) {
        abortController.abort();
      }
    },
  });

  return { requestId, stream };
}
