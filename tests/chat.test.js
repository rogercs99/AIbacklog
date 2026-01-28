import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("callChat", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("returns answer from Axet Flow", async () => {
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
