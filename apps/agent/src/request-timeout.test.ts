import { afterEach, expect, it, vi } from "vitest";
import { runAgent, type AgentRequest } from "./runtime";

afterEach(() => vi.restoreAllMocks());

it.each([undefined, 3_600_000])(
  "overrides SDK HTTP deadline with the host policy (%s)",
  async (timeoutMs) => {
    const timers = vi.spyOn(globalThis, "setTimeout");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const choices = [
        {
          delta: { role: "assistant", content: "complete" },
          finish_reason: null,
        },
        { delta: {}, finish_reason: "stop" },
      ];
      return new Response(
        choices
          .map(
            (choice) =>
              `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", model: "test", choices: [{ index: 0, ...choice }] })}\n\n`,
          )
          .join("") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    const input: AgentRequest = {
      version: 1,
      runId: "timeout-test",
      timeoutMs,
      disableRetry: true,
      key: "fixture",
      effort: "off",
      prompt: "answer",
      system: "answer",
      tools: [],
      model: {
        id: "test",
        name: "test",
        provider: "neoread",
        api: "openai-completions",
        baseUrl: "https://fixture.invalid/v1",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    };
    const result = await runAgent(
      input,
      () => {},
      async () => ({ content: [], details: undefined }),
      new AbortController().signal,
    );
    expect(result.text).toBe("complete");
    expect(
      timers.mock.calls.some(
        (call) => call[1] === (timeoutMs ?? 2_147_483_647),
      ),
    ).toBe(true);
    expect(timers.mock.calls.some((call) => call[1] === 600_000)).toBe(false);
  },
);
