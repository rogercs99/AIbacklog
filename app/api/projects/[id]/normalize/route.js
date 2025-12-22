import { NextResponse } from "next/server";
import { getDb, getLatestDocument } from "@/lib/db";
import { buildClarificationQuestions, buildLocalDescription, snippet } from "@/lib/local-basic-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeTitle(value = "") {
  const trimmed = String(value || "").trim();
  return trimmed.replace(/\s*\(\d+\)$/g, "").toLowerCase();
}

export async function POST(_request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const latestDoc = getLatestDocument(projectId);
  const contextSnippet = latestDoc?.text ? snippet(latestDoc.text, 600) : "";

  const items = db
    .prepare("SELECT * FROM backlog_items WHERE project_id = ? ORDER BY parent_id, id")
    .all(projectId)
    .map((item) => ({
      ...item,
      acceptance_criteria: parseJson(item.acceptance_criteria_json),
      dependencies: parseJson(item.dependencies_json),
      risks: parseJson(item.risks_json),
      labels: parseJson(item.labels_json),
      clarification_questions: parseJson(item.clarification_questions_json),
    }));

  const byParentAndTitle = new Map();
  items.forEach((item) => {
    const key = `${item.parent_id || 0}|${normalizeTitle(item.title)}`;
    if (!byParentAndTitle.has(key)) byParentAndTitle.set(key, []);
    byParentAndTitle.get(key).push(item);
  });

  let renamed = 0;
  let rewritten = 0;
  let clarified = 0;

  const update = db.prepare(
    "UPDATE backlog_items SET title = ?, description = ?, clarification_questions_json = ?, updated_at = ? WHERE id = ?",
  );

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    byParentAndTitle.forEach((list) => {
      if (list.length <= 1) return;
      list.forEach((item, idx) => {
        if (idx === 0) return;
        const area = item.area || "general";
        const base = item.title.replace(/\s*\(\d+\)$/g, "").trim();
        item.title = `${base} · ${area.toUpperCase()} #${idx + 1}`;
        renamed += 1;
      });
    });

    items.forEach((item) => {
      if (String(item.type || "").toLowerCase() !== "task") {
        return update.run(
          item.title,
          item.description,
          JSON.stringify(item.clarification_questions || []),
          now,
          item.id,
        );
      }
      const tooShort = !item.description || item.description.trim().length < 60;
      if (tooShort) {
        const detail = buildLocalDescription(
          item.title,
          item.area || "other",
          item.source_snippet || contextSnippet,
          contextSnippet,
        );
        item.description = detail.description || item.description || item.title;
        if (!item.clarification_questions || item.clarification_questions.length === 0) {
          item.clarification_questions = detail.clarification_questions || [];
          clarified += 1;
        }
        rewritten += 1;
      } else if (!item.clarification_questions || item.clarification_questions.length === 0) {
        item.clarification_questions = buildClarificationQuestions({
          title: item.title,
          content: item.source_snippet || contextSnippet,
          area: item.area || "other",
          type: item.type,
        });
        clarified += 1;
      }

      update.run(
        item.title,
        item.description,
        JSON.stringify(item.clarification_questions || []),
        now,
        item.id,
      );
    });
  });

  tx();

  return NextResponse.json({ ok: true, renamed, rewritten, clarified });
}
