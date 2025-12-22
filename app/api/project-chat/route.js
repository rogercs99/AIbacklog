import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { callChat } from "@/lib/chat";
import { chunkText } from "@/lib/chunking";
import { selectTopChunks } from "@/lib/search";
import { buildLocalChat } from "@/lib/local-basic-ai";
import {
  getDb,
  getLatestDocument,
  getProjectById,
  listBacklogItems,
  listChunksByDocument,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function snippet(text, limit = 220) {
  if (!text) {
    return "";
  }
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}...`;
}

function formatBacklogContext(items) {
  const rows = (Array.isArray(items) ? items : [])
    .filter((item) => (item.type || "").toLowerCase() !== "epic")
    .slice(0, 12)
    .map((item) => `- ${item.external_id || ""} ${snippet(item.title, 80)}`);
  return rows.length ? `Backlog (resumen):\n${rows.join("\n")}` : "";
}

function buildAnswerWithSources(answer, citations) {
  const ids = (Array.isArray(citations) ? citations : [])
    .map((cite) => cite?.chunk_id)
    .filter(Boolean);
  const unique = Array.from(new Set(ids)).slice(0, 6);
  if (!unique.length) {
    return answer;
  }
  return `${answer}\n\n---\n**Fuentes:** ${unique.join(", ")}`;
}

function ensureDefaultThread(db, projectId) {
  const existing = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM project_chat_threads WHERE project_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
    )
    .get(projectId);
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO project_chat_threads (project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(projectId, "Duda 1", now, now);
  return db
    .prepare("SELECT id, title, created_at, updated_at FROM project_chat_threads WHERE id = ?")
    .get(info.lastInsertRowid);
}

function listThreads(db, projectId) {
  return db
    .prepare(
      `
        SELECT
          t.id,
          t.title,
          t.created_at,
          t.updated_at,
          (SELECT COUNT(*) FROM project_chat_messages m WHERE m.thread_id = t.id) AS messages_count
        FROM project_chat_threads t
        WHERE t.project_id = ?
        ORDER BY t.updated_at DESC, t.id DESC
      `,
    )
    .all(projectId);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("projectId"));
  const threadIdParam = Number(searchParams.get("threadId"));
  if (!projectId) {
    return NextResponse.json({ error: "projectId requerido." }, { status: 400 });
  }

  const db = getDb();
  const project = getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const defaultThread = ensureDefaultThread(db, projectId);
  db.prepare(
    "UPDATE project_chat_messages SET thread_id = ? WHERE project_id = ? AND thread_id IS NULL",
  ).run(defaultThread.id, projectId);

  const memoryRow = db
    .prepare("SELECT memory, updated_at FROM project_memory WHERE project_id = ?")
    .get(projectId);

  const threads = listThreads(db, projectId);
  const activeThreadId = threadIdParam || threads?.[0]?.id || defaultThread.id;

  const messages = db
    .prepare(
      "SELECT role, content, created_at FROM project_chat_messages WHERE project_id = ? AND thread_id = ? ORDER BY id ASC",
    )
    .all(projectId, activeThreadId);

  return NextResponse.json({
    project,
    memory: memoryRow?.memory || "",
    threads,
    activeThreadId,
    messages: messages || [],
  });
}

export async function POST(request) {
  const body = await request.json();
  const projectId = Number(body?.projectId);
  const action = safeString(body?.action);
  const title = safeString(body?.title);
  const threadIdRaw = Number(body?.threadId);
  const message = safeString(body?.message);

  if (!projectId) {
    return NextResponse.json({ error: "projectId requerido." }, { status: 400 });
  }

  const db = getDb();
  const project = getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  if (action === "create_thread") {
    const now = new Date().toISOString();
    const threadTitle = title || "Nueva duda";
    const info = db
      .prepare(
        "INSERT INTO project_chat_threads (project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(projectId, threadTitle, now, now);
    const thread = db
      .prepare("SELECT id, title, created_at, updated_at FROM project_chat_threads WHERE id = ?")
      .get(info.lastInsertRowid);
    return NextResponse.json({ thread });
  }

  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
  }

  let activeThreadId = threadIdRaw;
  if (activeThreadId) {
    const thread = db
      .prepare("SELECT id FROM project_chat_threads WHERE id = ? AND project_id = ?")
      .get(activeThreadId, projectId);
    if (!thread) {
      activeThreadId = null;
    }
  }
  if (!activeThreadId) {
    const now = new Date().toISOString();
    const inferredTitle = snippet(message, 60) || "Nueva duda";
    const info = db
      .prepare(
        "INSERT INTO project_chat_threads (project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(projectId, inferredTitle, now, now);
    activeThreadId = info.lastInsertRowid;
  }

  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO project_chat_messages (project_id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(projectId, activeThreadId, "user", message, now);
  db.prepare("UPDATE project_chat_threads SET updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    activeThreadId,
  );

  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ?")
    .get(projectId);
  const currentMemory = safeString(memoryRow?.memory);

  const rawHistory = db
    .prepare(
      "SELECT role, content FROM project_chat_messages WHERE project_id = ? AND thread_id = ? ORDER BY id DESC LIMIT 14",
    )
    .all(projectId, activeThreadId);
  const history = [...rawHistory].reverse().map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: safeString(row.content),
  }));

  const latest = getLatestDocument(projectId);
  let chunks = [];
  if (latest) {
    chunks = listChunksByDocument(latest.id).map((chunk) => ({
      chunk_id: `CH-${String(chunk.chunk_index + 1).padStart(2, "0")}`,
      title: chunk.title || "General",
      content: chunk.content,
    }));
  }
  if (!chunks.length && latest?.text) {
    chunks = chunkText(latest.text).map((chunk) => ({
      chunk_id: chunk.chunk_id,
      title: chunk.title || "General",
      content: chunk.content,
    }));
  }
  const topChunks = chunks.length ? selectTopChunks(chunks, message, 4) : [];

  const backlog = listBacklogItems(projectId);
  const backlogContext = formatBacklogContext(backlog);

  const system = [
    "Eres un asistente de proyecto (consultoría).",
    "Tono: formal, claro y orientado a acción. Sin jerga innecesaria.",
    "Responde en el mismo idioma del usuario (ES/EN).",
    "Si falta información, di qué falta y sugiere preguntas concretas.",
    "Formato: Markdown con párrafos, listas y negritas cuando ayude.",
  ].join(" ");

  const hasProvider = Boolean(
    process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.LOCAL_AI_URL ||
      process.env.AI_BASE_URL,
  );

  if (process.env.LOCAL_AI_MODE === "basic" && !hasProvider) {
    const local = buildLocalChat(history);
    const answer = local.answer || "";
    db.prepare(
      "INSERT INTO project_chat_messages (project_id, role, content, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, "assistant", answer, new Date().toISOString());
    return NextResponse.json({ answer, citations: [] });
  }

  const user = [
    `PROYECTO:\n- Nombre: ${project.name}\n\nMEMORIA ACTUAL (persistente):\n${currentMemory || "N/A"}`,
    backlogContext ? `\n\n${backlogContext}` : "",
    topChunks.length ? `\n\nEXTRACTOS RELEVANTES DEL DOCUMENTO:\n${JSON.stringify(topChunks, null, 2)}` : "",
    `\n\nHILO (duda) activo: ${activeThreadId}`,
    "\n\nHISTORIAL (reciente):\n" +
      history
        .map((msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`)
        .join("\n"),
    `\n\nNUEVO MENSAJE DEL USUARIO:\n${message}`,
    "\n\nDevuelve SOLO JSON válido con este formato:",
    "{\n  \"answer\": \"... (Markdown)\",\n  \"citations\": [{\"chunk_id\":\"CH-01\",\"snippet\":\"...\"}],\n  \"memory_update\": \"... (máx 12 líneas, hechos y decisiones del proyecto)\"\n}",
  ]
    .filter(Boolean)
    .join("\n");

  let aiJson;
  try {
    aiJson = await callAI({ system, user, maxTokens: 900, temperature: 0.2 });
  } catch (error) {
    if (process.env.LOCAL_AI_MODE === "basic") {
      const local = buildLocalChat(history);
      const answer = local.answer || "";
      db.prepare(
        "INSERT INTO project_chat_messages (project_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      ).run(projectId, "assistant", answer, new Date().toISOString());
      return NextResponse.json({ answer, citations: [], memory: currentMemory });
    }
    try {
      const fallback = await callChat({ system, messages: history });
      const answer = fallback.answer || "";
      db.prepare(
        "INSERT INTO project_chat_messages (project_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      ).run(projectId, "assistant", answer, new Date().toISOString());
      return NextResponse.json({ answer, citations: [] });
    } catch (chatError) {
      return NextResponse.json(
        { error: error.message || "No se pudo llamar al modelo." },
        { status: 500 },
      );
    }
  }

  const answer = buildAnswerWithSources(safeString(aiJson?.answer), aiJson?.citations);
  const citations = Array.isArray(aiJson?.citations) ? aiJson.citations : [];
  const memoryUpdate = safeString(aiJson?.memory_update);

  db.prepare(
    "INSERT INTO project_chat_messages (project_id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(projectId, activeThreadId, "assistant", answer, new Date().toISOString());
  db.prepare("UPDATE project_chat_threads SET updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    activeThreadId,
  );

  if (memoryUpdate) {
    const existing = db
      .prepare("SELECT project_id FROM project_memory WHERE project_id = ?")
      .get(projectId);
    if (existing) {
      db.prepare("UPDATE project_memory SET memory = ?, updated_at = ? WHERE project_id = ?").run(
        memoryUpdate,
        new Date().toISOString(),
        projectId,
      );
    } else {
      db.prepare(
        "INSERT INTO project_memory (project_id, memory, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).run(projectId, memoryUpdate, new Date().toISOString(), new Date().toISOString());
    }
  }

  return NextResponse.json({
    answer,
    citations,
    memory: memoryUpdate || currentMemory,
    threadId: activeThreadId,
  });
}
