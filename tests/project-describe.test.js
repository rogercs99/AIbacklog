import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../lib/db.js";
import { GET } from "../app/api/projects/[id]/describe/route.js";

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

describe("Project description route", () => {
  beforeEach(() => {
    resetEnv();
    process.env.SQLITE_PATH = ":memory:";
    clearDb();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("returns existing description without calling the model", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const description = { description_es: "Hola", description_en: "Hello" };
    const info = db
      .prepare("INSERT INTO projects (name, created_at, description) VALUES (?, ?, ?)")
      .run("Proyecto demo", now, JSON.stringify(description));

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request(`http://localhost/api/projects/${info.lastInsertRowid}/describe`), {
      params: { id: String(info.lastInsertRowid) },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.generated).toBe(false);
    expect(payload.description.description_es).toBe("Hola");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generates and stores description when missing", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";

    const db = getDb();
    const now = new Date().toISOString();
    const info = db
      .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
      .run("Proyecto demo", now);

    db.prepare("INSERT INTO documents (project_id, version, text, created_at) VALUES (?, ?, ?, ?)")
      .run(info.lastInsertRowid, "v1", "Requisitos: login, catálogo.", now);

    db.prepare(
      `INSERT INTO backlog_items (
        project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
        story_points, estimate_hours, status, acceptance_criteria_json, dependencies_json,
        risks_json, labels_json, clarification_questions_json, source_chunk_id, source_snippet, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, ?, '[]', '[]', '[]', '[]', '[]', NULL, NULL, ?)
      `,
    ).run(info.lastInsertRowid, "T-001", "Epic", "Autenticación", "Desc", "backend", "High", "todo", now);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "{\"description_es\":\"Descripcion ES\",\"description_en\":\"Description EN\"}",
                },
              ],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request(`http://localhost/api/projects/${info.lastInsertRowid}/describe`), {
      params: { id: String(info.lastInsertRowid) },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.generated).toBe(true);
    expect(payload.description.description_es).toBe("Descripcion ES");
    expect(payload.description.description_en).toBe("Description EN");

    const updated = db.prepare("SELECT description FROM projects WHERE id = ?").get(info.lastInsertRowid);
    expect(updated.description).toContain("Descripcion ES");
  });
});
