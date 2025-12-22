import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, createPlanJob, createProject, getPlanJob } from "../lib/db.js";
import { processPlanQueueOnce } from "../lib/plan-queue.js";

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

describe("Plan jobs queue", () => {
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

  it("processes a queued plan job and stores result", async () => {
    const project = createProject("Proyecto cola");

    const aiPayload = {
      summary: "## Resumen\n\n- Alcance principal\n- Entregables\n\n**Riesgos:**\n- Pendiente de validar plazos",
      assumptions: ["Estimación inicial basada en un alcance mínimo."],
      missing_info: [],
      items: [
        {
          external_id: "T-001",
          type: "Epic",
          title: "Subproyecto: Catálogo",
          description: "Gestión de catálogo de películas.",
          area: "other",
          priority: "Medium",
          source_chunk_id: "CH-01",
          source_snippet: "Catálogo de películas",
          clarification_questions: [],
        },
        {
          external_id: "T-002",
          type: "Story",
          parent_external_id: "T-001",
          title: "Alta/edición de películas",
          description: "Permite crear y editar películas con metadatos.",
          area: "backend",
          priority: "High",
          source_chunk_id: "CH-01",
          source_snippet: "Alta de películas",
          clarification_questions: ["¿Campos obligatorios?"],
        },
      ],
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

    const job = createPlanJob({
      projectId: project.id,
      payload: {
        text: "1. Requisitos\n- Gestión de catálogo de películas\n- Alta de películas",
        version: "v1",
        context: "",
        projectId: project.id,
      },
    });

    expect(job.status).toBe("queued");

    await processPlanQueueOnce();

    const updated = getPlanJob(job.id);
    expect(updated.status).toBe("done");
    expect(updated.result_json).toBeTruthy();

    const result = JSON.parse(updated.result_json);
    expect(result.projectId).toBe(project.id);
    expect(result.created).toBeGreaterThan(0);

    const db = getDb();
    const backlogCount = db
      .prepare("SELECT COUNT(*) AS count FROM backlog_items WHERE project_id = ?")
      .get(project.id).count;
    expect(backlogCount).toBeGreaterThan(0);

    const doc = db
      .prepare("SELECT summary FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 1")
      .get(project.id);
    expect(doc.summary).toContain("Resumen");
  });
});
