import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../lib/db.js";
import { POST } from "../app/api/portfolio-chat/route.js";

const originalEnv = { ...process.env };

const resetEnv = () => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
};

const clearDb = () => {
  const db = getDb();
  db.exec(`
    DELETE FROM plan_jobs;
    DELETE FROM project_chat_threads;
    DELETE FROM project_chat_messages;
    DELETE FROM project_memory;
    DELETE FROM changes;
    DELETE FROM backlog_items;
    DELETE FROM chunks;
    DELETE FROM documents;
    DELETE FROM projects;
  `);
};

describe("Portfolio chat", () => {
  beforeEach(() => {
    resetEnv();
    process.env.SQLITE_PATH = ":memory:";
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    clearDb();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("returns 400 when messages are empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/portfolio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("includes local project/task context in the prompt", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const projectInfo = db
      .prepare("INSERT INTO projects (name, created_at, description) VALUES (?, ?, ?)")
      .run(
        "Pelis",
        now,
        JSON.stringify({
          description_es: "Sistema interno para ventas y compras de películas.",
          description_en: "",
        }),
      );

    db.prepare(
      `INSERT INTO backlog_items (
        project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
        story_points, estimate_hours, status, acceptance_criteria_json, dependencies_json,
        risks_json, labels_json, clarification_questions_json, source_chunk_id, source_snippet, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, 'other', 'Medium', NULL, NULL, 'todo', '[]', '[]', '[]', '[]', '[]', NULL, NULL, ?)`,
    ).run(
      projectInfo.lastInsertRowid,
      "T-100",
      "Task",
      "Crear películas",
      "Definir alta de películas y catálogo.",
      now,
    );

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Encontré la tarea en el proyecto Pelis." }] } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/portfolio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "¿En qué proyecto hay una tarea de crear películas?" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.answer).toContain("proyecto Pelis");

    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body);
    const prompt = body.contents?.[0]?.parts?.[0]?.text || "";
    expect(prompt).toContain("Pelis");
    expect(prompt).toContain("Crear películas");
  });
});

