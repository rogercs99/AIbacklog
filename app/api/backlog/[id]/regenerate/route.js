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

function appendHistory(existingHistory, entry, limit = 12) {
  const history = Array.isArray(existingHistory) ? [...existingHistory] : [];
  history.push(entry);
  return history.slice(-limit);
}

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

  const existingQuestions = parseJson(item?.clarification_questions_json, []);
  const existingHistory = parseJson(item?.description_history_json, []);
  const now = new Date().toISOString();

  let description = String(item.description || "").trim();
  let clarification_questions = serializeQaList(existingQuestions);

  if (process.env.LOCAL_AI_MODE === "basic") {
    const detail = buildLocalDescription(
      item.title,
      item.area || "other",
      item.source_snippet || contextSnippet,
      contextSnippet,
    );
    if (detail.description) {
      description = detail.description;
    }
    const mergedQa = mergeQaLists(clarification_questions, detail.clarification_questions || []);
    clarification_questions = serializeQaList(mergedQa);
  } else {
    const system =
      "Eres un analista funcional senior. Devuelve solo JSON válido sin texto extra.";
    const user = [
      `Genera una descripcion clara para publico no tecnico manteniendo el contexto existente.`,
      ``,
      `INPUT:`,
      `- titulo: ${item.title}`,
      `- tipo: ${item.type}`,
      `- area: ${item.area || "other"}`,
      `- descripcion_actual: ${item.description || "N/A"}`,
      `- preguntas_existentes (NO borrar respondidas):`,
      ...(clarification_questions.length ? clarification_questions.map((q) => `  - ${q}`) : ["  - N/A"]),
      `- snippet_fuente: ${item.source_snippet || contextSnippet || "N/A"}`,
      `- memoria_proyecto: ${projectMemory || "N/A"}`,
      ``,
      `OUTPUT JSON:`,
      `{ \"description\": \"...\", \"suggested_questions\": [\"...\"] }`,
      ``,
      `REGLAS:`,
      `- NO elimines informacion previa de descripcion_actual: integrala.`,
      `- Usa Markdown bien estructurado: titulos (##), listas y tablas si aportan claridad.`,
      `- Incluye sección "**Información confirmada**" con bullets si hay respuestas.`,
      `- suggested_questions solo debe incluir preguntas nuevas (sin duplicar preguntas_existentes).`,
      `- No menciones modelos ni IA.`,
    ].join("\n");
    try {
      const ai = await callAI({ system, user, maxTokens: 600 });
      if (typeof ai?.description === "string" && ai.description.trim().length >= 60 && !/^Q[:=]/i.test(ai.description.trim())) {
        const facts = extractAnsweredFacts(clarification_questions);
        const merged = mergeFactsIntoDescription(ai.description.trim(), facts);
        description = merged || ai.description.trim();
      }
      const suggested = Array.isArray(ai?.suggested_questions)
        ? ai.suggested_questions
        : Array.isArray(ai?.clarification_questions)
          ? ai.clarification_questions
          : [];
      const mergedQa = mergeQaLists(clarification_questions, suggested);
      clarification_questions = serializeQaList(mergedQa);
    } catch (error) {
      const detail = buildLocalDescription(
        item.title,
        item.area || "other",
        item.source_snippet || contextSnippet,
        contextSnippet,
      );
      if (detail.description) {
        description = detail.description;
      }
      const mergedQa = mergeQaLists(clarification_questions, detail.clarification_questions || []);
      clarification_questions = serializeQaList(mergedQa);
    }
  }

  const nextHistory = appendHistory(
    existingHistory.length ? existingHistory : [{ source: "ingest", text: item.description || "", at: item.updated_at || now }],
    { source: "regen", text: description || item.description || "", at: now },
  );
  db.prepare(
    "UPDATE backlog_items SET description = ?, clarification_questions_json = ?, description_history_json = ?, updated_at = ? WHERE id = ?",
  ).run(description, JSON.stringify(clarification_questions), JSON.stringify(nextHistory), now, id);

  const updated = db.prepare("SELECT * FROM backlog_items WHERE id = ?").get(id);

  return NextResponse.json({
    item: {
      ...updated,
      clarification_questions: clarification_questions,
    },
  });
}
