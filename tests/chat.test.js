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

  it("returns answer from OpenAI-compatible API", async () => {
    process.env.LOCAL_AI_URL = "http://localhost:1234/v1";
    process.env.LOCAL_AI_MODEL = "test-model";
    process.env.AI_ALLOW_NO_KEY = "1";

    const fakeResponse = {
      choices: [{ message: { content: "Hola" } }],
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => fakeResponse,
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
