import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildLocalDescription } from "@/lib/local-basic-ai";
import {
  createProject,
  getDb,
  getDefaultProject,
  getLatestDocument,
  getNextExternalId,
  listBacklogItems,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonField(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function snippet(text, limit = 240) {
  if (!text) {
    return "";
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}...`;
}

function isGenericEpicTitle(value = "") {
  const val = String(value || "").trim().toLowerCase();
  return ["subproyecto general", "general", "default", "sin subproyecto", "misc"].includes(val);
}

function normalizeItemType(value) {
  const raw = String(value || "").toLowerCase();
  const trimmed = raw.trim();
  if (
    trimmed === "us" ||
    trimmed === "u.s" ||
    raw.includes("user story") ||
    raw.includes("userstory") ||
    raw.includes("historia de usuario")
  ) {
    return "Task";
  }
  if (
    raw.includes("initiative") ||
    raw.includes("iniciativa") ||
    raw.includes("subproyecto") ||
    raw.includes("epic") ||
    raw.includes("epica") ||
    raw.includes("épica")
  ) {
    return "Epic";
  }
  if (raw.includes("feature") || raw.includes("funcionalidad")) {
    return "Story";
  }
  if (raw.includes("task") || raw.includes("tarea") || raw.includes("subtask") || raw.includes("subtarea")) {
    return "Task";
  }
  if (raw.includes("story") || raw.includes("historia")) {
    return "Story";
  }
  return "Story";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("projectId"));
  const project = projectId ? getDb().prepare("SELECT * FROM projects WHERE id = ?").get(projectId) : getDefaultProject();
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
  const items = listBacklogItems(project.id).map((item) => ({
    ...item,
    acceptance_criteria: parseJsonField(item.acceptance_criteria_json),
    dependencies: parseJsonField(item.dependencies_json),
    risks: parseJsonField(item.risks_json),
    labels: parseJsonField(item.labels_json),
    clarification_questions: parseJsonField(item.clarification_questions_json),
  }));
  return NextResponse.json({ items, project });
}

export async function POST(request) {
  const body = await request.json();
  const item = body?.item;
  if (!item) {
    return NextResponse.json({ error: "Item invalido." }, { status: 400 });
  }

  let project = null;
  if (item.project_id) {
    project = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(item.project_id);
  }
  if (!project) {
    project = getDefaultProject();
  }
  if (item.project_name && !item.project_id) {
    project = createProject(item.project_name);
  }
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO backlog_items (
      project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
      story_points, estimate_hours, status, acceptance_criteria_json, dependencies_json,
      risks_json, labels_json, clarification_questions_json, source_chunk_id, source_snippet, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const itemType = normalizeItemType(item.type || "Story");
  const itemTypeLower = itemType.toLowerCase();
  const isEpic = itemTypeLower === "epic";
  const isStory = itemTypeLower === "story";
  const isTask = itemTypeLower === "task";

  const ensureDefaultEpic = () => {
    const latestDoc = getLatestDocument(project.id);
    const contextSnippet = latestDoc ? snippet(latestDoc.text, 180) : "";
    const existingEpic = db
      .prepare(
        "SELECT id, external_id FROM backlog_items WHERE project_id = ? AND lower(type) = 'epic' ORDER BY id ASC LIMIT 1",
      )
      .get(project.id);
    if (existingEpic) {
      return existingEpic;
    }
    const epicExternalId = getNextExternalId(project.id);
    const info = insert.run(
      project.id,
      epicExternalId,
      "Epic",
      null,
      null,
      `Subproyecto: ${project.name || "Principal"}`,
      contextSnippet
        ? `Contexto base: ${contextSnippet}`
        : "Agrupa tareas con el contexto actual del proyecto.",
      "other",
      "Medium",
      null,
      null,
      "todo",
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      null,
      null,
      now,
    );
    return { id: info.lastInsertRowid, external_id: epicExternalId };
  };

  const ensureDefaultStory = (epic) => {
    if (!epic?.id) {
      return null;
    }
    const existingStory = db
      .prepare(
        "SELECT id, external_id, epic_key, parent_id FROM backlog_items WHERE project_id = ? AND lower(type) = 'story' AND parent_id = ? ORDER BY id ASC LIMIT 1",
      )
      .get(project.id, epic.id);
    if (existingStory) {
      return existingStory;
    }
    const storyExternalId = getNextExternalId(project.id);
    const info = insert.run(
      project.id,
      storyExternalId,
      "Story",
      epic.id,
      epic.external_id,
      "Feature general",
      "Feature creada automáticamente para poder asociar User Stories.",
      "other",
      "Medium",
      null,
      null,
      "todo",
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([
        "¿Cuál es el flujo exacto (pasos) que debe soportar?",
        "¿Qué criterios de aceptación usaréis para validarla?",
      ]),
      null,
      null,
      now,
    );
    return { id: info.lastInsertRowid, external_id: storyExternalId, epic_key: epic.external_id, parent_id: epic.id };
  };

  let parentId = item.parent_id ? Number(item.parent_id) : null;
  let epicKey = item.epic_key || null;

  if (isEpic) {
    parentId = null;
    epicKey = null;
    if (isGenericEpicTitle(item.title)) {
      const latestDoc = getLatestDocument(project.id);
      const contextSnippet = latestDoc ? snippet(latestDoc.text, 160) : "";
      item.title = `Subproyecto: ${project.name || "Principal"}`;
      if (!item.description || item.description.trim().length < 24) {
        item.description =
          contextSnippet || item.description || "Agrupa tareas del proyecto con contexto definido.";
      }
    }
  } else if (isStory) {
    // Story (Feature) cuelga de Epic (Subproyecto/Iniciativa)
    if (parentId) {
      const parent = db
        .prepare("SELECT id, external_id, type FROM backlog_items WHERE id = ? AND project_id = ?")
        .get(parentId, project.id);
      if (parent && String(parent.type || "").toLowerCase() === "epic") {
        epicKey = parent.external_id;
      } else {
        parentId = null;
      }
    }
    if (!parentId) {
      const epic = ensureDefaultEpic();
      parentId = epic.id;
      epicKey = epic.external_id;
    }
  } else if (isTask) {
    // Task (User Story) cuelga de Story (Feature)
    let storyParent = null;
    if (parentId) {
      const parent = db
        .prepare(
          "SELECT id, external_id, type, epic_key, parent_id FROM backlog_items WHERE id = ? AND project_id = ?",
        )
        .get(parentId, project.id);
      const parentType = String(parent?.type || "").toLowerCase();
      if (parent && parentType === "story") {
        storyParent = parent;
      } else if (parent && parentType === "epic") {
        storyParent = ensureDefaultStory(parent);
      } else {
        parentId = null;
      }
    }
    if (!storyParent) {
      const epic = ensureDefaultEpic();
      storyParent = ensureDefaultStory(epic);
    }
    parentId = storyParent?.id || null;
    if (storyParent?.epic_key) {
      epicKey = storyParent.epic_key;
    } else if (storyParent?.parent_id) {
      const epicRow = db
        .prepare("SELECT external_id FROM backlog_items WHERE id = ? AND project_id = ? LIMIT 1")
        .get(storyParent.parent_id, project.id);
      epicKey = epicRow?.external_id || null;
    } else {
      epicKey = null;
    }
  } else {
    // Fallback defensivo: tratar como Story
    const epic = ensureDefaultEpic();
    parentId = epic.id;
    epicKey = epic.external_id;
  }

  const externalId = item.external_id || getNextExternalId(project.id);

  let description = item.description || "";
  let clarificationQuestions = Array.isArray(item.clarification_questions)
    ? item.clarification_questions
    : [];
  const latestDoc = getLatestDocument(project.id);
  const contextSnippet = latestDoc ? snippet(latestDoc.text, 420) : "";
  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(project.id);
  const projectMemory = (memoryRow?.memory || "").toString().trim();
  const needsAiDetail = !description || clarificationQuestions.length === 0;
  if (needsAiDetail) {
    if (process.env.LOCAL_AI_MODE === "basic") {
      const detail = buildLocalDescription(
        item.title,
        item.area || "other",
        item.source_snippet || "",
        contextSnippet,
      );
      description = description || detail.description || "";
      if (!clarificationQuestions.length) {
        clarificationQuestions = detail.clarification_questions || [];
      }
    } else {
      const system =
        "Eres un analista funcional. Devuelve solo JSON válido y usable.";
      const user = `Genera una descripcion detallada para publico no tecnico y una lista de preguntas para afinar requisitos.\n\nREGLAS PARA description:\n- Usa Markdown.\n- Empieza con 2-4 frases en lenguaje sencillo (sin jerga) explicando el objetivo y el resultado esperado.\n- Incluye una seccion \"Que haremos\" con 3-6 bullets accionables.\n- Incluye una seccion \"Que validar\" con 2-4 bullets.\n\nINPUT:\n- titulo: ${item.title}\n- tipo: ${itemType}\n- area: ${item.area || "other"}\n- contexto_proyecto: ${project.name || ""}\n- memoria_proyecto: ${projectMemory || "N/A"}\n- snippet_documento: ${contextSnippet || "N/A"}\n- source_snippet: ${item.source_snippet || ""}\n\nOUTPUT JSON:\n{ \"description\": \"...\", \"clarification_questions\": [\"...\"] }`;
      try {
        const aiResult = await callAI({ system, user });
        description = aiResult?.description || "";
        if (!clarificationQuestions.length) {
          clarificationQuestions = Array.isArray(aiResult?.clarification_questions)
            ? aiResult.clarification_questions
            : [];
        }
      } catch (error) {
        if (!description || !clarificationQuestions.length) {
          const fallback = buildLocalDescription(
            item.title,
            item.area || "other",
            item.source_snippet || "",
            contextSnippet,
          );
          description = description || fallback.description || item.description || "";
          if (!clarificationQuestions.length) {
            clarificationQuestions = fallback.clarification_questions || [];
          }
        }
      }
    }
  }

  insert.run(
    project.id,
    externalId,
    itemType,
    parentId,
    epicKey,
    item.title,
    description,
    item.area || "other",
    item.priority || "Medium",
    item.story_points ?? null,
    item.estimate_hours ?? null,
    item.status || "todo",
    JSON.stringify(item.acceptance_criteria || []),
    JSON.stringify(item.dependencies || []),
    JSON.stringify(item.risks || []),
    JSON.stringify(item.labels || []),
    JSON.stringify(clarificationQuestions),
    item.source_chunk_id || null,
    item.source_snippet || null,
    now,
  );

  return NextResponse.json({ ok: true });
}
