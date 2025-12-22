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

describe("Gemini provider", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("callAI uses Gemini when AI_PROVIDER=gemini", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }],
      }),
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
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).toContain(":generateContent");

    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].text).toContain("SYSTEM:");
    expect(body.contents[0].parts[0].text).toContain("USER:");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("callChat uses Gemini when AI_PROVIDER=gemini", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Hola" }] } }],
      }),
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
