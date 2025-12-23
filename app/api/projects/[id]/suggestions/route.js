import { NextResponse } from "next/server";
import { getDb, getNextExternalId, insertBacklogItems, getLatestDocument } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function snippet(text, limit = 180) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit)}...`;
}

export async function GET(_request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const db = getDb();
  const row = db
    .prepare("SELECT id, project_id, source_item_id, items_json, created_at FROM suggested_items WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId);
  return NextResponse.json({
    suggestions: row ? parseJson(row.items_json, []) : [],
    source_item_id: row?.source_item_id || null,
    created_at: row?.created_at || null,
  });
}

export async function DELETE(_request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM suggested_items WHERE project_id = ?").run(projectId);
  return NextResponse.json({ ok: true });
}

export async function POST(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "Sin items para aplicar." }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const latestDoc = getLatestDocument(projectId);
  const contextSnippet = latestDoc?.text ? snippet(latestDoc.text, 200) : "";

  // Asignar external_id secuencial
  let nextId = getNextExternalId(projectId);
  let counter = Number(nextId.replace(/[^0-9]/g, "")) || 1;
  const nextExternalId = () => {
    const id = `T-${String(counter).padStart(3, "0")}`;
    counter += 1;
    return id;
  };

  const rows = items.map((item) => {
    const typeLower = String(item.type || "Task").toLowerCase();
    return {
      external_id: item.external_id || nextExternalId(),
      type: typeLower === "story" ? "Story" : "Task",
      parent_id: item.parent_id || null,
      epic_key: item.epic_key || null,
      title: item.title || "Nuevo item",
      description: item.description || item.title || "",
      area: item.area || "other",
      priority: item.priority || "Medium",
      story_points: item.story_points ?? null,
      estimate_hours: item.estimate_hours ?? null,
      status: "todo",
      acceptance_criteria: Array.isArray(item.acceptance_criteria) ? item.acceptance_criteria : [],
      dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
      risks: Array.isArray(item.risks) ? item.risks : [],
      labels: Array.isArray(item.labels) ? item.labels : [],
      clarification_questions: Array.isArray(item.clarification_questions)
        ? item.clarification_questions
        : [],
      source_chunk_id: item.source_chunk_id || null,
      source_snippet: item.source_snippet || contextSnippet || "",
    };
  });

  insertBacklogItems(projectId, rows);
  db.prepare("DELETE FROM suggested_items WHERE project_id = ?").run(projectId);

  return NextResponse.json({ ok: true, created: rows.length });
}
