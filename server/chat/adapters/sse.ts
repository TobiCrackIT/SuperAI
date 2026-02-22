export type ParsedSseEvent = {
  data: string;
  event?: string;
};

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      while (true) {
        const boundaryIndex = buffer.indexOf("\n\n");
        if (boundaryIndex === -1) {
          break;
        }

        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const lines = rawEvent.split("\n");
        const dataLines: string[] = [];
        let eventName: string | undefined;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim();
            continue;
          }

          if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trimStart());
          }
        }

        if (dataLines.length === 0) {
          continue;
        }

        yield {
          event: eventName,
          data: dataLines.join("\n"),
        };
      }
    }

    const remainder = buffer.trim();
    if (remainder.startsWith("data:")) {
      yield {
        data: remainder
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trimStart())
          .join("\n"),
      };
    }
  } finally {
    reader.releaseLock();
  }
}

export async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    bodyText = "";
  }

  const suffix = bodyText ? ` ${bodyText.slice(0, 200)}` : "";
  throw new Error(`Provider request failed (${response.status}).${suffix}`);
}
