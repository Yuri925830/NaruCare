import { describe, expect, it } from "vitest";
import { documentConversationHistory, type DocumentConversationMessage } from "./documentConversation";

function turns(count: number, answerLength = 20): DocumentConversationMessage[] {
  return Array.from({ length: count }, (_, index) => [
    { role: "user" as const, content: `Question ${index}: ${"q".repeat(1_900)}` },
    { role: "assistant" as const, content: "a".repeat(answerLength) },
  ]).flat();
}

describe("document conversation follow-up history", () => {
  it("includes the most recent six complete exchanges and leaves earlier messages in the UI", () => {
    const messages = turns(10);
    const before = [...messages];
    expect(documentConversationHistory(messages)).toEqual(messages.slice(-12));
    expect(messages).toEqual(before);
  });

  it("removes older exchanges when long replies would exceed the server history budget", () => {
    const messages = turns(6, 12_000);
    const history = documentConversationHistory(messages);
    expect(history).toEqual(messages.slice(-6));
    expect(history.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(48_000);
    expect(history[0].role).toBe("user");
    expect(history.at(-1)?.role).toBe("assistant");
  });

  it("excludes an oversized recent reply instead of sending a partial clinical explanation", () => {
    expect(documentConversationHistory(turns(1, 12_001))).toEqual([]);
  });

  it("starts new questions with empty history and does not invent context", () => {
    expect(documentConversationHistory([])).toEqual([]);
  });
});
