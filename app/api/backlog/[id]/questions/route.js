import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { buildLocalDescription } from "@/lib/local-basic-ai";
import { getDb, getLatestDocument } from "@/lib/db";
import { mergeQaLists, serializeQaList } from "@/lib/qa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function POST(_request, { params }) {
  const id = Number(params?.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const db = getDb();
  const item = db.prepare("SELECT * FROM backlog_items WHERE id = ? LIMIT 1").get(id);
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado." }, { status: 404 });
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ? LIMIT 1").get(item.project_id);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const latestDoc = getLatestDocument(project.id);
  const contextSnippet = latestDoc?.text ? String(latestDoc.text).slice(0, 1200) : "";
  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(project.id);
  const projectMemory = String(memoryRow?.memory || "").trim();

  const existingQuestions = serializeQaList(parseJson(item.clarification_questions_json, []));
  const existingBlock = existingQuestions.length
    ? existingQuestions.map((q) => `- ${q}`).join("\n")
    : "- N/A";

  let suggested = [];
  if (process.env.LOCAL_AI_MODE === "basic") {
    const detail = buildLocalDescription(
      item.title,
      item.area || "other",
      item.source_snippet || contextSnippet,
      contextSnippet,
    );
    suggested = detail.clarification_questions || [];
  } else {
    const system =
      "Eres un analista funcional senior. Devuelve solo JSON válido sin texto extra.";
    const user = [
      `Genera MÁS preguntas de aclaración (3-5) para completar este elemento.`,
      `No repitas preguntas existentes y NO incluyas prefijos 'Q:' o 'A:' en las preguntas.`,
      ``,
      `INPUT:`,
      `- titulo: ${item.title}`,
      `- tipo: ${item.type}`,
      `- area: ${item.area || "other"}`,
      `- descripcion_actual: ${item.description || "N/A"}`,
      `- snippet_fuente: ${item.source_snippet || contextSnippet || "N/A"}`,
      `- memoria_proyecto: ${projectMemory || "N/A"}`,
      ``,
      `PREGUNTAS EXISTENTES:`,
      existingBlock,
      ``,
      `OUTPUT JSON:`,
      `{ \"questions\": [\"...\"] }`,
      ``,
      `REGLAS:`,
      `- Las preguntas deben ser concretas y accionables.`,
      `- Si ya hay suficientes datos, devuelve [].`,
    ].join("\n");
    try {
      const ai = await callAI({ system, user, maxTokens: 350, temperature: 0.2 });
      suggested = Array.isArray(ai?.questions) ? ai.questions : [];
    } catch (error) {
      const detail = buildLocalDescription(
        item.title,
        item.area || "other",
        item.source_snippet || contextSnippet,
        contextSnippet,
      );
      suggested = detail.clarification_questions || [];
    }
  }

  const merged = mergeQaLists(existingQuestions, suggested);
  const finalQuestions = serializeQaList(merged);

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE backlog_items SET clarification_questions_json = ?, updated_at = ? WHERE id = ?",
  ).run(JSON.stringify(finalQuestions), now, id);

  return NextResponse.json({ ok: true, clarification_questions: finalQuestions });
}

