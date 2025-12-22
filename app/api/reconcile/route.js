/*
Pasos seguidos:
1) Comparar los chunks de la versión anterior y la nueva para detectar cambios.
2) Enviar backlog + cambios + chunks al modelo para proponer acciones.
3) Devolver el JSON con create, update, obsolete y preguntas para cliente.
*/
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { chunkText } from "@/lib/chunking";
import { diffChunks } from "@/lib/diff";
import { buildLocalReconcile } from "@/lib/local-basic-ai";
import {
  getDefaultProject,
  getLatestDocument,
  getProjectById,
  insertChunks,
  insertDocument,
  listBacklogItems,
  listChunksByDocument,
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

export async function POST(request) {
  const body = await request.json();
  const text = (body?.text || "").trim();
  const version = body?.version || "v2";
  const projectId = Number(body?.projectId);

  if (!text) {
    return NextResponse.json({ error: "Documento vacio." }, { status: 400 });
  }

  let project = null;
  if (projectId) {
    project = getProjectById(projectId);
  }
  if (!project) {
    project = getDefaultProject();
  }
  const latest = getLatestDocument(project.id);
  if (!latest) {
    return NextResponse.json({ error: "No hay documento base." }, { status: 400 });
  }

  const oldChunks = listChunksByDocument(latest.id).map((chunk) => ({
    chunk_id: `CH-${String(chunk.chunk_index + 1).padStart(2, "0")}`,
    title: chunk.title || "General",
    content: chunk.content,
  }));

  const newDocumentId = insertDocument(project.id, version, text);
  const newChunks = chunkText(text).map((chunk) => ({
    ...chunk,
    document_id: newDocumentId,
  }));
  insertChunks(
    newDocumentId,
    newChunks.map((chunk) => ({
      chunk_index: chunk.chunk_index,
      title: chunk.title,
      content: chunk.content,
    })),
  );

  const changes = diffChunks(oldChunks, newChunks);

  const backlogItems = listBacklogItems(project.id).map((item) => ({
    external_id: item.external_id,
    type: item.type,
    parent_id: item.parent_id,
    epic_key: item.epic_key,
    title: item.title,
    description: item.description,
    area: item.area,
    priority: item.priority,
    story_points: item.story_points,
    estimate_hours: item.estimate_hours,
    status: item.status,
    acceptance_criteria: parseJsonField(item.acceptance_criteria_json),
    dependencies: parseJsonField(item.dependencies_json),
    labels: parseJsonField(item.labels_json),
    risks: parseJsonField(item.risks_json),
    clarification_questions: parseJsonField(item.clarification_questions_json),
    source_chunk_id: item.source_chunk_id,
    source_snippet: item.source_snippet,
  }));

  const system =
    "Eres un change impact analyst. Devuelve SOLO JSON con acciones claras.";
  const user = `Dado un backlog existente + cambios detectados + nuevo documento, decide qué crear, qué actualizar y qué marcar obsoleto.\n\nREGLAS:\n- Si no puedes mapear un cambio a un ítem con confianza, NO inventes: crea una pregunta en questions_for_client.\n- Mantén los external_id existentes cuando actualices.\n- Los create_items deben incluir clarification_questions (array de preguntas para el cliente).\n- Devuelve SOLO JSON.\n\nOUTPUT:\n{\n  \"create_items\":[{... backlog item ...}],\n  \"update_items\":[{\"external_id\":\"T-001\",\"patch\":{\"title\":\"...\",\"description\":\"...\",\"acceptance_criteria\":[...],\"clarification_questions\":[...]}}],\n  \"mark_obsolete\":[\"T-099\"],\n  \"questions_for_client\":[{\"question\":\"...\",\"priority\":\"High|Medium|Low\",\"reason\":\"...\"}]\n}\n\nBACKLOG:\n${JSON.stringify(backlogItems, null, 2)}\n\nCHANGES:\n${JSON.stringify(changes, null, 2)}\n\nNEW_CHUNKS:\n${JSON.stringify(
    newChunks.map((chunk) => ({
      chunk_id: chunk.chunk_id,
      title: chunk.title,
      content: chunk.content,
    })),
    null,
    2,
  )}`;

  let aiResult;
  if (process.env.LOCAL_AI_MODE === "basic") {
    aiResult = buildLocalReconcile(changes, backlogItems, newChunks);
  } else {
    try {
      aiResult = await callAI({ system, user });
    } catch (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo llamar al modelo." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    from_version: latest.version,
    to_version: version,
    changes,
    actions: aiResult,
    new_document_id: newDocumentId,
  });
}
