import { describe, expect, it } from "vitest";
import { persistCompareRunRequestSchema } from "@/types/chat";

describe("persistCompareRunRequestSchema", () => {
  it("accepts a valid completed compare run payload", () => {
    const parsed = persistCompareRunRequestSchema.parse({
      prompt: "Compare these models",
      requestId: "req_123",
      status: "complete",
      targets: [
        {
          targetId: "openai:1:0",
          provider: "openai",
          connectionId: "11111111-1111-4111-8111-111111111111",
          connectionLabel: "OpenAI personal",
          model: "gpt-4o-mini",
          status: "done",
          content: "Hello",
        },
      ],
    });

    expect(parsed.targets[0]?.provider).toBe("openai");
  });

  it("rejects non-final run status values", () => {
    expect(() =>
      persistCompareRunRequestSchema.parse({
        prompt: "Bad payload",
        status: "streaming",
        targets: [
          {
            targetId: "openai:1:0",
            provider: "openai",
            connectionLabel: "OpenAI",
            model: "gpt-4o-mini",
            status: "streaming",
            content: "",
          },
        ],
      }),
    ).toThrow();
  });
});
