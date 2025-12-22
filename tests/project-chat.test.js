import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../lib/db.js";
import { GET, POST } from "../app/api/project-chat/route.js";

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

describe("Project chat (threads)", () => {
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

  it("GET creates a default thread and migrates old messages", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const info = db
      .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
      .run("Proyecto demo", now);

    db.prepare(
      "INSERT INTO project_chat_messages (project_id, thread_id, role, content, created_at) VALUES (?, NULL, ?, ?, ?)",
    ).run(info.lastInsertRowid, "user", "Hola", now);

    const response = await GET(
      new Request(`http://localhost/api/project-chat?projectId=${info.lastInsertRowid}`),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Array.isArray(payload.threads)).toBe(true);
    expect(payload.threads.length).toBe(1);
    expect(payload.activeThreadId).toBeTruthy();

    const migrated = db
      .prepare(
        "SELECT thread_id FROM project_chat_messages WHERE project_id = ? ORDER BY id ASC LIMIT 1",
      )
      .get(info.lastInsertRowid);
    expect(Number(migrated.thread_id)).toBe(Number(payload.activeThreadId));
  });

  it("POST action=create_thread inserts a new thread", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const info = db
      .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
      .run("Proyecto demo", now);

    const response = await POST(
      new Request("http://localhost/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: info.lastInsertRowid,
          action: "create_thread",
          title: "Nueva duda",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.thread?.id).toBeTruthy();
    expect(payload.thread?.title).toBe("Nueva duda");

    const count = db
      .prepare("SELECT COUNT(*) AS count FROM project_chat_threads WHERE project_id = ?")
      .get(info.lastInsertRowid).count;
    expect(count).toBe(1);
  });

  it("POST message stores assistant answer and updates project memory", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const info = db
      .prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)")
      .run("Proyecto demo", now);

    const aiPayload = {
      answer: "**OK**\\n\\n- Punto 1\\n- Punto 2",
      citations: [{ chunk_id: "CH-01", snippet: "SLA respuesta 4 horas" }],
      memory_update: "Hecho: SLA=4h",
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(aiPayload) }],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: info.lastInsertRowid,
          message: "¿Cuál es el SLA?",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.answer).toContain("**OK**");
    expect(payload.answer).toContain("**Fuentes:** CH-01");
    expect(payload.threadId).toBeTruthy();

    const stored = db
      .prepare(
        "SELECT COUNT(*) AS count FROM project_chat_messages WHERE project_id = ? AND thread_id = ?",
      )
      .get(info.lastInsertRowid, payload.threadId).count;
    expect(stored).toBe(2);

    const memory = db
      .prepare("SELECT memory FROM project_memory WHERE project_id = ?")
      .get(info.lastInsertRowid);
    expect(memory.memory).toContain("SLA=4h");
  });
});

