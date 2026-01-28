import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAI } from "../lib/ai.js";
import { callChat } from "../lib/chat.js";

const originalEnv = { ...process.env };

const resetEnv = () => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
};

describe("Axet Flow provider", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("callAI uses Axet Flow when AI_PROVIDER=axet", async () => {
    process.env.AI_PROVIDER = "axet";
    process.env.AXET_FLOW_JSON_URL = "http://localhost:46228/axetflow/ai";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ result: { ok: true } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI({
      system: "System prompt",
      user: "User prompt",
      maxTokens: 100,
      temperature: 0.2,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0][0];
    expect(String(url)).toContain("/axetflow/ai");

    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body);
    expect(body.mode).toBe("json");
    expect(body.system).toContain("System prompt");
    expect(body.user).toContain("User prompt");
  });

  it("callChat uses Axet Flow when AI_PROVIDER=axet", async () => {
    process.env.AI_PROVIDER = "axet";
    process.env.AXET_FLOW_CHAT_URL = "http://localhost:46228/axetflow/ai";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ answer: "Hola" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callChat({
      system: "Eres un asistente.",
      messages: [{ role: "user", content: "Hola" }],
    });

    expect(result.answer).toBe("Hola");
    expect(fetchMock).toHaveBeenCalled();
  });
});
