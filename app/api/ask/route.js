/*
Pasos seguidos:
1) Buscar los chunks más relevantes con similitud local para la pregunta.
2) Enviar solo esos chunks al modelo y pedir respuesta con citas.
3) Devolver el JSON de respuesta sin texto adicional.
*/
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { chunkText } from "@/lib/chunking";
import { getDefaultProject, getLatestDocument, getProjectById, listChunksByDocument } from "@/lib/db";
import { selectTopChunks } from "@/lib/search";
import { buildLocalAsk } from "@/lib/local-basic-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const question = (body?.question || "").trim();
  const overrideText = (body?.text || "").trim();
  const projectId = Number(body?.projectId);

  if (!question) {
    return NextResponse.json({ error: "Pregunta vacia." }, { status: 400 });
  }

  let chunks = [];
  if (overrideText) {
    chunks = chunkText(overrideText).map((chunk) => ({
      chunk_id: chunk.chunk_id,
      title: chunk.title || "General",
      content: chunk.content,
    }));
  } else {
    let project = null;
    if (projectId) {
      project = getProjectById(projectId);
    }
    if (!project) {
      project = getDefaultProject();
    }
    const document = getLatestDocument(project.id);
    if (!document) {
      return NextResponse.json(
        { error: "No hay documento cargado. Puedes pegar un texto en Ask." },
        { status: 400 },
      );
    }
    chunks = listChunksByDocument(document.id).map((chunk) => ({
      chunk_id: `CH-${String(chunk.chunk_index + 1).padStart(2, "0")}`,
      title: chunk.title || "General",
      content: chunk.content,
    }));
  }

  const topChunks = selectTopChunks(chunks, question, 4);

  const system =
    "Respondes como analista. Usa solo el contexto dado y devuelve JSON sin texto extra. El campo answer debe estar en Markdown.";
  const user = `Responde SOLO usando el CONTEXTO proporcionado. Si no está, di que no aparece.\n\nFormato:\n- El campo answer debe usar Markdown (negritas, listas).\n\nDevuelve JSON:\n{\n  \"answer\":\"...\",\n  \"citations\":[{\"chunk_id\":\"CH-01\",\"snippet\":\"...\"}],\n  \"if_not_found\": true/false,\n  \"follow_up_questions\":[\"...\"]\n}\n\nPREGUNTA:\n${question}\n\nCONTEXTO:\n${JSON.stringify(topChunks, null, 2)}`;

  let aiResult;
  if (process.env.LOCAL_AI_MODE === "basic") {
    aiResult = buildLocalAsk(question, topChunks);
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
  return NextResponse.json(aiResult);
}
