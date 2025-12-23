import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonField(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function GET(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    return NextResponse.json({ error: "No existe el proyecto." }, { status: 404 });
  }

  const documents = db
    .prepare(
      "SELECT id, version, created_at, LENGTH(text) AS size, summary, assumptions_json, missing_info_json FROM documents WHERE project_id = ? ORDER BY id DESC",
    )
    .all(projectId);
  const documentsWithInsights = documents.map((doc) => ({
    ...doc,
    summary: doc.summary || "",
    assumptions: parseJsonField(doc.assumptions_json),
    missing_info: parseJsonField(doc.missing_info_json),
  }));

  const backlogRaw = db
    .prepare("SELECT * FROM backlog_items WHERE project_id = ? ORDER BY id ASC")
    .all(projectId);

  const backlog = backlogRaw.map((item) => ({
    ...item,
    acceptance_criteria: parseJsonField(item.acceptance_criteria_json),
    dependencies: parseJsonField(item.dependencies_json),
    risks: parseJsonField(item.risks_json),
    labels: parseJsonField(item.labels_json),
    clarification_questions: parseJsonField(item.clarification_questions_json),
  }));

  const suggestionsRow = db
    .prepare(
      "SELECT items_json, source_item_id, created_at FROM suggested_items WHERE project_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(projectId);

  const epics = backlog.filter((item) => (item.type || "").toLowerCase() === "epic");
  let subprojects = epics.map((epic) => {
    const directChildren = backlog.filter((item) => item.parent_id === epic.id);
    const stories = directChildren.filter((item) => (item.type || "").toLowerCase() === "story");
    const storyIds = new Set(stories.map((story) => story.id));
    const nestedTasks = backlog.filter(
      (item) =>
        (item.type || "").toLowerCase() === "task" &&
        item.parent_id &&
        storyIds.has(item.parent_id),
    );
    const legacyTasks = directChildren.filter((item) => (item.type || "").toLowerCase() === "task");
    const children = [...stories, ...nestedTasks, ...legacyTasks];
    const doneCount = children.filter((item) => item.status === "done").length;
    return {
      external_id: epic.external_id,
      name: epic.title,
      items: children.length,
      status: children.length ? `${doneCount}/${children.length} done` : "Sin items",
    };
  });

  if (subprojects.length === 0) {
    const areaMap = new Map();
    backlog
      .filter((item) => (item.type || "").toLowerCase() !== "epic")
      .forEach((item) => {
        const area = item.area || "other";
        areaMap.set(area, (areaMap.get(area) || 0) + 1);
      });
    subprojects = Array.from(areaMap.entries()).map(([area, count]) => ({
      external_id: null,
      name: area,
      items: count,
      status: "Agrupado por área",
    }));
  }

  const tasks = backlog
    .filter((item) => (item.type || "").toLowerCase() !== "epic")
    .map((item) => ({
      ...item,
      area: item.area || "other",
      status: item.status || "todo",
    }));

  return NextResponse.json({
    project,
    documents: documentsWithInsights,
    epics,
    subprojects,
    tasks,
    suggestions: suggestionsRow ? parseJsonField(suggestionsRow.items_json, []) : [],
    stats: {
      documents: documentsWithInsights.length,
      backlog: backlog.length,
      subprojects: subprojects.length,
    },
  });
}

export async function PATCH(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const body = await request.json();
  const name = (body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
  }
  const db = getDb();
  db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, projectId);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  return NextResponse.json({ project });
}

export async function DELETE(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const db = getDb();
  const tx = db.transaction(() => {
    const docs = db.prepare("SELECT id FROM documents WHERE project_id = ?").all(projectId);
    const docIds = docs.map((doc) => doc.id);
    if (docIds.length) {
      const placeholders = docIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM chunks WHERE document_id IN (${placeholders})`).run(docIds);
    }
    db.prepare("DELETE FROM documents WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM backlog_items WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM changes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_chat_messages WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_chat_threads WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_memory WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM plan_jobs WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  });
  tx();
  return NextResponse.json({ ok: true });
}
