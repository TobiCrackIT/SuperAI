import { ensureOk, parseSseStream } from "@/server/chat/adapters/sse";
import type {
  ModelAdapter,
  ModelStreamTarget,
} from "@/server/chat/adapters/types";

type GoogleStreamPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
};

async function requestGoogleStream(
  target: ModelStreamTarget,
): Promise<Response> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    target.model,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(target.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: target.prompt }],
        },
      ],
    }),
    signal: target.signal,
  });

  return ensureOk(response);
}

async function* streamText(target: ModelStreamTarget) {
  const response = await requestGoogleStream(target);

  if (!response.body) {
    throw new Error("Google returned an empty stream body.");
  }

  for await (const event of parseSseStream(response.body)) {
    if (!event.data) {
      continue;
    }

    let payload: GoogleStreamPayload;
    try {
      payload = JSON.parse(event.data) as GoogleStreamPayload;
    } catch {
      continue;
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");

    if (text) {
      yield { type: "delta" as const, delta: text };
    }

    if (candidate?.finishReason) {
      yield {
        type: "done" as const,
        finishReason: candidate.finishReason,
      };
      return;
    }
  }

  yield { type: "done" as const };
}

export const googleAdapter: ModelAdapter = {
  provider: "google",
  streamText,
};
