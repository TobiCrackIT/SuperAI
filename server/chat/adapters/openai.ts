import { ensureOk, parseSseStream } from "@/server/chat/adapters/sse";
import type {
  ModelAdapter,
  ModelStreamTarget,
} from "@/server/chat/adapters/types";

type OpenAiStreamPayload = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

async function requestOpenAiStream(
  target: ModelStreamTarget,
): Promise<Response> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${target.apiKey}`,
    },
    body: JSON.stringify({
      model: target.model,
      stream: true,
      messages: [{ role: "user", content: target.prompt }],
    }),
    signal: target.signal,
  });

  return ensureOk(response);
}

async function* streamText(target: ModelStreamTarget) {
  const response = await requestOpenAiStream(target);

  if (!response.body) {
    throw new Error("OpenAI returned an empty stream body.");
  }

  for await (const event of parseSseStream(response.body)) {
    if (event.data === "[DONE]") {
      yield { type: "done" as const };
      return;
    }

    let payload: OpenAiStreamPayload;
    try {
      payload = JSON.parse(event.data) as OpenAiStreamPayload;
    } catch {
      continue;
    }

    const choice = payload.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      yield { type: "delta" as const, delta };
    }

    if (choice?.finish_reason) {
      yield { type: "done" as const, finishReason: choice.finish_reason };
      return;
    }
  }

  yield { type: "done" as const };
}

export const openAiAdapter: ModelAdapter = {
  provider: "openai",
  streamText,
};
