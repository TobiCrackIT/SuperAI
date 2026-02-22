import type { CompareStreamEvent } from "@/types/chat";

export function formatSseEvent(event: CompareStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
