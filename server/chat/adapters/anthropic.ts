import { ensureOk, parseSseStream } from "@/server/chat/adapters/sse";
import type {
  ModelAdapter,
  ModelStreamTarget,
} from "@/server/chat/adapters/types";

type AnthropicEventPayload = {
  delta?: { text?: string; type?: string };
  type?: string;
};

async function requestAnthropicStream(
  target: ModelStreamTarget,
): Promise<Response> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": target.apiKey,
    },
    body: JSON.stringify({
      model: target.model,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: "user", content: target.prompt }],
    }),
    signal: target.signal,
  });

  return ensureOk(response);
}

async function* streamText(target: ModelStreamTarget) {
  const response = await requestAnthropicStream(target);

  if (!response.body) {
    throw new Error("Anthropic returned an empty stream body.");
  }

  for await (const event of parseSseStream(response.body)) {
    if (!event.data) {
      continue;
    }

    let payload: AnthropicEventPayload;
    try {
      payload = JSON.parse(event.data) as AnthropicEventPayload;
    } catch {
      continue;
    }

    if (
      (event.event === "content_block_delta" ||
        payload.type === "content_block_delta") &&
      payload.delta?.type === "text_delta" &&
      payload.delta.text
    ) {
      yield { type: "delta" as const, delta: payload.delta.text };
      continue;
    }

    if (event.event === "message_stop" || payload.type === "message_stop") {
      yield { type: "done" as const };
      return;
    }
  }

  yield { type: "done" as const };
}

export const anthropicAdapter: ModelAdapter = {
  provider: "anthropic",
  streamText,
};
