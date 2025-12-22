import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function snippet(text, limit = 520) {
  if (!text) {
    return "";
  }
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}...`;
}

function safeParseDescription(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && (parsed.description_es || parsed.description_en)) {
      return parsed;
    }
    return null;
  } catch (error) {
    return { description_es: String(value), description_en: "" };
  }
}

function normalizeMarkdown(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export async function GET(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const force = ["1", "true", "yes"].includes(
    String(url.searchParams.get("force") || "").toLowerCase(),
  );

  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    return NextResponse.json({ error: "No existe el proyecto." }, { status: 404 });
  }

  const existing = safeParseDescription(project.description);
  if (existing && !force) {
    return NextResponse.json({ description: existing, generated: false });
  }

  const latestDoc = db
    .prepare("SELECT version, text, created_at FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId);
  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(projectId);
  const backlog = db
    .prepare(
      `
        SELECT external_id, type, title, area, priority, status
        FROM backlog_items
        WHERE project_id = ?
        ORDER BY id ASC
        LIMIT 30
      `,
    )
    .all(projectId);

  const backlogLines = backlog.map((item) => {
    const id = item.external_id || "";
    const type = item.type || "";
    const area = item.area || "other";
    const priority = item.priority || "Medium";
    const status = item.status || "todo";
    const title = snippet(item.title || "", 90);
    return `- ${id} [${type}] ${title} (${area}, ${priority}, ${status})`;
  });

  const system =
    "Eres un consultor de negocio y producto. Tu objetivo es explicar un proyecto de manera formal, clara y sin tecnicismos.";

  const user = `Genera una descripción ejecutiva de este proyecto para que alguien no técnico entienda de qué va y qué se está construyendo.\n\nREGLAS:\n- No inventes funcionalidades que no estén respaldadas por el contexto.\n- Evita jerga técnica.\n- Usa Markdown: 1-2 párrafos + lista de bullets (3-6) para el alcance + lista de (3-6) preguntas a cliente.\n- Devuelve SOLO JSON válido (sin texto extra, sin \`\`\`).\n\nOUTPUT JSON:\n{\n  \"description_es\": \"...\",\n  \"description_en\": \"...\"\n}\n\nCONTEXTO:\n- Nombre del proyecto: ${project.name}\n- Memoria/Contexto guardado: ${memoryRow?.memory ? snippet(memoryRow.memory, 520) : "N/A"}\n- Último documento (${latestDoc?.version || "N/A"}): ${latestDoc?.text ? snippet(latestDoc.text, 520) : "N/A"}\n- Backlog (muestra):\n${backlogLines.length ? backlogLines.join("\n") : "- N/A"}\n\nRecuerda: sin tecnicismos, tono corporativo, y que se entienda rápido.`;

  let result;
  try {
    result = await callAI({ system, user, maxTokens: 900, temperature: 0.2 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo generar la descripción." },
      { status: 500 },
    );
  }

  const description = {
    description_es: normalizeMarkdown(result?.description_es || ""),
    description_en: normalizeMarkdown(result?.description_en || ""),
  };

  if (!description.description_es && !description.description_en) {
    return NextResponse.json(
      { error: "La IA no devolvió una descripción." },
      { status: 500 },
    );
  }

  db.prepare("UPDATE projects SET description = ? WHERE id = ?").run(
    JSON.stringify(description),
    projectId,
  );

  return NextResponse.json({ description, generated: true });
}

