import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildLocalDescription } from "@/lib/local-basic-ai";
import { getDb, getLatestDocument } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const id = Number(params?.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const db = getDb();
  const item = db
    .prepare(
      "SELECT * FROM backlog_items WHERE id = ? LIMIT 1",
    )
    .get(id);
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado." }, { status: 404 });
  }
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ? LIMIT 1")
    .get(item.project_id);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const latestDoc = getLatestDocument(project.id);
  const contextSnippet = latestDoc?.text ? latestDoc.text.slice(0, 1200) : "";
  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(project.id);
  const projectMemory = (memoryRow?.memory || "").toString().trim();

  let description = "";
  let clarification_questions = [];

  if (process.env.LOCAL_AI_MODE === "basic") {
    const detail = buildLocalDescription(
      item.title,
      item.area || "other",
      item.source_snippet || contextSnippet,
      contextSnippet,
    );
    description = detail.description || "";
    clarification_questions = detail.clarification_questions || [];
  } else {
    const system =
      "Eres un analista funcional senior. Devuelve solo JSON válido sin texto extra.";
    const user = `Genera una descripcion clara para publico no tecnico y preguntas si faltan datos.\n\nINPUT:\n- titulo: ${item.title}\n- tipo: ${item.type}\n- area: ${item.area || "other"}\n- descripcion_actual: ${item.description || "N/A"}\n- snippet_fuente: ${item.source_snippet || contextSnippet}\n- memoria_proyecto: ${projectMemory || "N/A"}\n\nOUTPUT JSON:\n{ \"description\": \"...\", \"clarification_questions\": [\"...\"] }`;
    try {
      const ai = await callAI({ system, user, maxTokens: 600 });
      description = ai?.description || "";
      clarification_questions = Array.isArray(ai?.clarification_questions)
        ? ai.clarification_questions
        : [];
    } catch (error) {
      const detail = buildLocalDescription(
        item.title,
        item.area || "other",
        item.source_snippet || contextSnippet,
        contextSnippet,
      );
      description = detail.description || item.description || "";
      clarification_questions = detail.clarification_questions || [];
    }
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE backlog_items SET description = ?, clarification_questions_json = ?, updated_at = ? WHERE id = ?",
  ).run(description, JSON.stringify(clarification_questions), now, id);

  const updated = db.prepare("SELECT * FROM backlog_items WHERE id = ?").get(id);

  return NextResponse.json({
    item: {
      ...updated,
      clarification_questions: clarification_questions,
    },
  });
}
