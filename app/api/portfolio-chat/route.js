import { NextResponse } from "next/server";
import { callChat } from "@/lib/chat";
import { buildLocalChat } from "@/lib/local-basic-ai";
import { selectTopChunks } from "@/lib/search";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((msg) => ({
      role: msg?.role === "assistant" ? "assistant" : "user",
      content: safeString(msg?.content),
    }))
    .filter((msg) => msg.content.length > 0);
}

function snippet(text, limit = 360) {
  if (!text) {
    return "";
  }
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}...`;
}

function parseProjectDescription(value) {
  const raw = safeString(value);
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw);
    return safeString(parsed?.description_es || parsed?.description_en || "");
  } catch (error) {
    return raw;
  }
}

export async function POST(request) {
  const body = await request.json();
  const messages = sanitizeMessages(body?.messages);
  if (!messages.length) {
    return NextResponse.json({ error: "Mensajes vacíos." }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
  const query = safeString(lastUser?.content);
  if (!query) {
    return NextResponse.json({ error: "Pregunta vacía." }, { status: 400 });
  }

  const db = getDb();
  const projects = db.prepare("SELECT id, name, description FROM projects ORDER BY created_at DESC").all();
  const tasks = db
    .prepare(
      `
        SELECT
          b.id,
          b.project_id,
          p.name AS project_name,
          b.external_id,
          b.type,
          b.title,
          b.description,
          b.status,
          b.priority,
          b.blocked_reason
        FROM backlog_items b
        JOIN projects p ON p.id = b.project_id
        ORDER BY b.updated_at DESC
        LIMIT 800
      `,
    )
    .all();

  const chunks = [
    ...projects.map((p) => ({
      chunk_id: `PRJ-${p.id}`,
      title: `Proyecto: ${p.name}`,
      content: parseProjectDescription(p.description) || "",
    })),
    ...tasks.map((t) => ({
      chunk_id: `TASK-${t.id}`,
      title: `[${t.project_name}] ${t.external_id || ""} ${t.title || ""}`.trim(),
      content: [
        `type=${t.type || ""}`,
        `status=${t.status || ""}`,
        `priority=${t.priority || ""}`,
        t.blocked_reason ? `blocked_reason=${snippet(t.blocked_reason, 160)}` : "",
        t.description ? `description=${snippet(t.description, 520)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    })),
  ].filter((chunk) => safeString(chunk.title) || safeString(chunk.content));

  const topChunks = chunks.length ? selectTopChunks(chunks, query, 14) : [];
  const context = topChunks.length
    ? JSON.stringify(
        topChunks.map((chunk) => ({
          chunk_id: chunk.chunk_id,
          title: chunk.title,
          content: snippet(chunk.content, 560),
        })),
        null,
        2,
      )
    : "[]";

  const system = [
    "Eres un asistente de portfolio (multi‑proyecto).",
    "Tu trabajo: responder preguntas sobre proyectos y tareas almacenadas localmente.",
    "Responde en el idioma del usuario (ES/EN).",
    "Formato: Markdown con párrafos, listas y **negritas** cuando ayude.",
    "No inventes: si el contexto no contiene la respuesta, indícalo y sugiere cómo buscarla.",
    "Cuando la pregunta sea de localizar tareas, devuelve una lista clara con:",
    "- Proyecto",
    "- ID de tarea (external_id)",
    "- Estado, prioridad y si está bloqueada",
    "",
    "CONTEXTO RELEVANTE (JSON):",
    context,
  ].join("\n");

  const hasProvider = Boolean(
    process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.LOCAL_AI_URL ||
      process.env.AI_BASE_URL,
  );

  if (process.env.LOCAL_AI_MODE === "basic" && !hasProvider) {
    return NextResponse.json(buildLocalChat(messages));
  }

  try {
    const result = await callChat({ system, messages });
    return NextResponse.json(result);
  } catch (error) {
    if (process.env.LOCAL_AI_MODE === "basic") {
      return NextResponse.json(buildLocalChat(messages));
    }
    return NextResponse.json(
      { error: error.message || "No se pudo llamar al modelo." },
      { status: 500 },
    );
  }
}

