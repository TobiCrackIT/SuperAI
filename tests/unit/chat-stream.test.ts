import { describe, expect, it } from "vitest";
import { formatSseEvent } from "@/server/chat/sse";
import { compareChatRequestSchema } from "@/types/chat";

describe("compareChatRequestSchema", () => {
  it("accepts a valid compare request", () => {
    const parsed = compareChatRequestSchema.parse({
      prompt: "Compare this answer",
      targets: [
        {
          provider: "openai",
          model: "gpt-4o-mini",
        },
        {
          provider: "anthropic",
          model: "claude-3-5-haiku-latest",
        },
      ],
    });

    expect(parsed.targets).toHaveLength(2);
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      compareChatRequestSchema.parse({
        prompt: "Hello",
        targets: [{ provider: "unknown", model: "x" }],
      }),
    ).toThrow();
  });
});

describe("formatSseEvent", () => {
  it("serializes stream events as SSE data frames", () => {
    const sse = formatSseEvent({
      type: "session_started",
      requestId: "req_123",
      timestamp: "2026-02-22T12:00:00.000Z",
      targetCount: 2,
    });

    expect(sse.startsWith("data: ")).toBe(true);
    expect(sse.endsWith("\n\n")).toBe(true);
    expect(sse).toContain('"type":"session_started"');
  });
});
