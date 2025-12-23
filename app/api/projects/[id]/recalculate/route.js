import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { parseQaList, serializeQaList } from "@/lib/qa";

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

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeQuestionText(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9¿?áéíóúüñ\\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilarQuestion(a, b) {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const setA = new Set(na.split(" "));
  const setB = new Set(nb.split(" "));
  const intersection = [...setA].filter((w) => setB.has(w));
  const score = intersection.length / Math.max(setA.size, setB.size, 1);
  return score >= 0.6;
}

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function extractConfirmedFacts(memory = "") {
  const lines = String(memory || "").split("\n");
  const idx = lines.findIndex((line) => line.trim().toUpperCase() === "HECHOS CONFIRMADOS:");
  if (idx === -1) {
    return new Map();
  }
  const facts = new Map();
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^-\\s*(.+?)\\s*:\\s*(.+)\\s*$/);
    if (!match) continue;
    const question = String(match[1] || "").trim();
    const answer = String(match[2] || "").trim();
    if (!question || !answer) continue;
    facts.set(question.toLowerCase(), { question, answer });
  }
  return facts;
}

function mergeProjectMemory(currentMemory = "", generatedMemory = "") {
  const current = safeString(currentMemory);
  const generated = safeString(generatedMemory);

  if (!generated) {
    return current;
  }

  const facts = new Map();
  extractConfirmedFacts(current).forEach((value, key) => facts.set(key, value));
  extractConfirmedFacts(generated).forEach((value, key) => facts.set(key, value));

  if (facts.size === 0) {
    return generated;
  }

  const factLines = Array.from(facts.values()).map((fact) => `- ${fact.question}: ${fact.answer}`);
  const final = [generated, "", "HECHOS CONFIRMADOS:", ...factLines].join("\n").trim();
  const limited = final.split("\n").slice(-120).join("\n").trim();
  return limited;
}

function mergeFactsIntoDescription(description = "", facts = []) {
  const clean = String(description || "").trim();
  const factLines = (Array.isArray(facts) ? facts : [])
    .map((fact) => String(fact || "").trim())
    .filter(Boolean)
    .map((fact) => `- ${fact}`);
  if (!factLines.length) {
    return clean;
  }
  const heading = "**Información confirmada**";
  if (!clean) {
    return [heading, ...factLines].join("\n");
  }
  if (clean.includes(heading)) {
    const existing = new Set(clean.split("\n").map((line) => line.trim()));
    const additions = factLines.filter((line) => !existing.has(line.trim()));
    if (!additions.length) {
      return clean;
    }
    return `${clean}\n${additions.join("\n")}`;
  }
  return `${clean}\n\n${heading}\n${factLines.join("\n")}`;
}

function appendHistory(existingHistory, entry, limit = 12) {
  const history = Array.isArray(existingHistory) ? [...existingHistory] : [];
  history.push(entry);
  return history.slice(-limit);
}

async function dedupeQuestionsAcrossProject(db, projectId) {
  const rows = db
    .prepare(
      "SELECT id, type, parent_id, epic_key, title, description, description_history_json, updated_at, clarification_questions_json FROM backlog_items WHERE project_id = ?",
    )
    .all(projectId);

  const specificity = (type) => {
    const t = String(type || "").toLowerCase();
    if (t === "task") return 3;
    if (t === "story") return 2;
    if (t === "epic") return 1;
    return 0;
  };

  const items = rows.map((row) => ({
    ...row,
    qa: parseQaList(row.clarification_questions_json || []),
  }));

  const groups = new Map();
  items.forEach((item) => {
    item.qa.forEach((qa, idx) => {
      const key = normalizeQuestionText(qa.question);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ item, qaIndex: idx });
    });
  });

  const applyGroups = (groupList) => {
    groupList.forEach((entries) => {
      if (!entries || entries.length <= 1) return;
      const winner = entries
        .slice()
        .sort((a, b) => specificity(b.item.type) - specificity(a.item.type))[0];
      const winningQa = winner.item.qa[winner.qaIndex];
      entries.forEach((entry) => {
        if (entry === winner) return;
        const qa = entry.item.qa[entry.qaIndex];
        if (!winningQa.answer && qa.answer) {
          winningQa.answer = qa.answer;
        }
        entry.item.qa.splice(entry.qaIndex, 1);
      });
    });
  };

  applyGroups([...groups.values()]);

  // AI grouping
  const flatQuestions = [];
  items.forEach((item) => {
    item.qa.forEach((qa, idx) => {
      flatQuestions.push({
        id: `${item.id}-${idx}`,
        question: qa.question,
        type: item.type,
        title: item.title,
      });
    });
  });

  if (flatQuestions.length > 1 && flatQuestions.length <= 40) {
    const prompt = [
      "Agrupa preguntas equivalentes (mismo significado). Devuelve JSON: { \"groups\": [[\"id1\",\"id2\"], ...] }",
      "Usa solo ids provistos. No inventes preguntas.",
      "Preguntas:",
      JSON.stringify(
        flatQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          item_type: q.type,
          item_title: q.title,
        })),
        null,
        2,
      ),
    ].join("\n");

    try {
      const ai = await callAI({
        system: "Eres un analista que agrupa preguntas duplicadas. Solo responde JSON válido.",
        user: prompt,
        maxTokens: 400,
        temperature: 0.1,
      });
      if (ai?.groups && Array.isArray(ai.groups)) {
        const entryMap = new Map();
        items.forEach((item) => {
          item.qa.forEach((qa, idx) => entryMap.set(`${item.id}-${idx}`, { item, qaIndex: idx }));
        });
        const aiGroups = ai.groups
          .map((grp) => (Array.isArray(grp) ? grp.map((id) => entryMap.get(String(id))).filter(Boolean) : []))
          .filter((grp) => grp.length > 1);
        applyGroups(aiGroups);
      }
    } catch (error) {
      // silencioso
    }
  }

  // Persist
  const update = db.prepare(
    "UPDATE backlog_items SET clarification_questions_json = ?, description = ?, description_history_json = ?, updated_at = ? WHERE id = ?",
  );
  const now = new Date().toISOString();
  let updated = 0;
  items.forEach((item) => {
    const original = rows.find((r) => r.id === item.id);
    if (!original) return;
    const nextQuestions = serializeQaList(item.qa);
    const prevQa = parseQaList(original.clarification_questions_json || []);
    const answersAdded =
      item.qa.filter((qa) => qa.answer).length > prevQa.filter((qa) => qa.answer).length;
    let nextDescription = item.description || original.description || "";
    if (answersAdded) {
      const facts = item.qa.filter((qa) => qa.answer).map((qa) => `${qa.question}: ${qa.answer}`);
      nextDescription = mergeFactsIntoDescription(nextDescription, facts);
    }
    const prevHistory = parseJson(original.description_history_json, []);
    const nextHistory = appendHistory(
      prevHistory.length ? prevHistory : [{ source: "ingest", text: original.description || "", at: original.updated_at || now }],
      { source: "qa-dedupe", text: nextDescription, at: now },
    );
    if (
      JSON.stringify(nextQuestions) !== JSON.stringify(prevQa.map((qa) => qa.question ? `Q: ${qa.question}${qa.answer ? ` | A: ${qa.answer}` : ""}` : "")) ||
      nextDescription !== (original.description || "")
    ) {
      updated += 1;
      update.run(
        JSON.stringify(nextQuestions),
        nextDescription,
        JSON.stringify(nextHistory),
        now,
        item.id,
      );
    }
  });

  return { updated };
}

function applyConfirmedFactsToBacklog(db, projectId, memory) {
  const facts = extractConfirmedFacts(memory);
  if (!facts.size) {
    return { filled: 0, updated_descriptions: 0 };
  }
  const rows = db
    .prepare(
      "SELECT id, description, description_history_json, updated_at, clarification_questions_json FROM backlog_items WHERE project_id = ?",
    )
    .all(projectId);

  const update = db.prepare(
    "UPDATE backlog_items SET clarification_questions_json = ?, description = ?, description_history_json = ?, updated_at = ? WHERE id = ?",
  );

  let filled = 0;
  let updatedDescriptions = 0;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const list = parseQaList(parseJson(row.clarification_questions_json, []));
      if (!list.length) {
        return;
      }
      const newlyAnsweredFacts = [];
      let changed = false;
      list.forEach((qa) => {
        if (qa.answer) {
          return;
        }
        const fact = facts.get(String(qa.question || "").trim().toLowerCase());
        if (!fact?.answer) {
          return;
        }
        qa.answer = fact.answer;
        changed = true;
        filled += 1;
        newlyAnsweredFacts.push(`${qa.question}: ${fact.answer}`);
      });
      if (!changed) {
        return;
      }
      const nextQuestions = serializeQaList(list);
      const nextDescription = mergeFactsIntoDescription(row.description || "", newlyAnsweredFacts);
      const prevHistory = parseJson(row.description_history_json, []);
      const nextHistory = appendHistory(
        prevHistory.length ? prevHistory : [{ source: "ingest", text: row.description || "", at: row.updated_at || now }],
        { source: "qa-propagated", text: nextDescription, at: now },
      );
      if (nextDescription !== String(row.description || "").trim()) {
        updatedDescriptions += 1;
      }
      update.run(
        JSON.stringify(nextQuestions),
        nextDescription,
        JSON.stringify(nextHistory),
        now,
        row.id,
      );
    });
  });
  tx();

  return { filled, updated_descriptions: updatedDescriptions };
}

function deduplicateBacklog(db, projectId) {
  const items = db
    .prepare(
      "SELECT id, parent_id, type, title FROM backlog_items WHERE project_id = ? ORDER BY id ASC",
    )
    .all(projectId);
  const keep = new Map();
  const duplicates = [];
  items.forEach((item) => {
    const key = `${String(item.type || "").toLowerCase()}|${item.parent_id || 0}|${String(item.title || "")
      .trim()
      .toLowerCase()}`;
    if (!keep.has(key)) {
      keep.set(key, item.id);
    } else {
      duplicates.push({ id: item.id, keepId: keep.get(key) });
    }
  });
  if (!duplicates.length) {
    return { removed: 0 };
  }
  const updateParent = db.prepare("UPDATE backlog_items SET parent_id = ? WHERE parent_id = ?");
  const deleteItem = db.prepare("DELETE FROM backlog_items WHERE id = ?");
  const tx = db.transaction(() => {
    duplicates.forEach(({ id, keepId }) => {
      updateParent.run(keepId, id);
      deleteItem.run(id);
    });
  });
  tx();
  return { removed: duplicates.length };
}

function buildLocalFallback({ project, latestDoc, backlog }) {
  const total = backlog.length;
  const done = backlog.filter((item) => item.status === "done").length;
  const blocked = backlog.filter((item) => Boolean(item.blocked_reason)).length;

  const descriptionEs = [
    `## Descripción del proyecto`,
    ``,
    `Este proyecto organiza el trabajo a partir de documentos y tareas guardadas, para mantener el alcance y el plan de entrega bajo control.`,
    ``,
    `**Estado actual (resumen):**`,
    `- Tareas totales: ${total}`,
    `- Hechas: ${done}`,
    `- Bloqueadas: ${blocked}`,
    latestDoc?.summary ? `\n**Último documento:**\n${latestDoc.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    description: {
      description_es: descriptionEs,
      description_en: "",
    },
    memory_update: `Proyecto: ${project.name}\nTareas: ${total}\nHechas: ${done}\nBloqueadas: ${blocked}`,
  };
}

export async function POST(request, { params }) {
  const projectId = Number(params?.id);
  if (!projectId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    return NextResponse.json({ error: "No existe el proyecto." }, { status: 404 });
  }

  const latestDoc = db
    .prepare(
      "SELECT id, version, summary, text, created_at FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(projectId);

  const backlog = db
    .prepare(
      `
        SELECT id, external_id, type, title, description, area, priority, status, blocked_reason
        FROM backlog_items
        WHERE project_id = ?
        ORDER BY id ASC
        LIMIT 80
      `,
    )
    .all(projectId);

  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(projectId);
  const currentMemory = safeString(memoryRow?.memory);

  const system = [
    "Eres un consultor senior de delivery y PMO.",
    "Objetivo: recalcular el contexto del proyecto a partir del estado real (tareas, estados y documentos).",
    "Tono: formal, claro y apto para público no técnico.",
    "Devuelve SOLO JSON válido (sin texto extra).",
  ].join(" ");

  const user = [
    `PROYECTO:\n- id: ${project.id}\n- nombre: ${project.name}`,
    currentMemory ? `\n\nMEMORIA ACTUAL (persistente):\n${currentMemory}` : "",
    latestDoc
      ? `\n\nÚLTIMO DOCUMENTO:\n- version: ${latestDoc.version}\n- resumen: ${latestDoc.summary || "N/A"}\n- extracto: ${snippet(
          latestDoc.text,
          800,
        )}`
      : "\n\nÚLTIMO DOCUMENTO: N/A",
    backlog.length
      ? `\n\nBACKLOG (muestra):\n${JSON.stringify(
          backlog.map((item) => ({
            external_id: item.external_id,
            type: item.type,
            title: snippet(item.title, 120),
            status: item.status,
            priority: item.priority,
            blocked_reason: item.blocked_reason ? snippet(item.blocked_reason, 160) : "",
          })),
          null,
          2,
        )}`
      : "\n\nBACKLOG: N/A",
    `\n\nOUTPUT JSON:\n{\n  \"description_es\": \"... (Markdown)\",\n  \"description_en\": \"... (Markdown)\",\n  \"memory_update\": \"... (máx 12 líneas, hechos/decisiones/estado actual)\"\n}\n\nREGLAS:\n- Si hay tareas bloqueadas, dilo y resume causas.\n- Si hay tareas en done, menciona progreso.\n- No menciones modelos, prompts, IA ni herramientas internas.\n- Usa listas y negritas cuando ayuden.\n`,
  ]
    .filter(Boolean)
    .join("\n");

  let aiJson;
  try {
    aiJson = await callAI({ system, user, maxTokens: 900, temperature: 0.2 });
  } catch (error) {
    const fallback = buildLocalFallback({ project, latestDoc, backlog });
    const description = fallback.description;
    const memory_update = fallback.memory_update;
    const mergedMemory = mergeProjectMemory(currentMemory, memory_update);
    db.prepare("UPDATE projects SET description = ? WHERE id = ?").run(
      JSON.stringify(description),
      projectId,
    );
    const now = new Date().toISOString();
    const existing = db
      .prepare("SELECT project_id FROM project_memory WHERE project_id = ?")
      .get(projectId);
    if (existing) {
      db.prepare("UPDATE project_memory SET memory = ?, updated_at = ? WHERE project_id = ?").run(
        mergedMemory,
        now,
        projectId,
      );
    } else {
      db.prepare(
        "INSERT INTO project_memory (project_id, memory, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).run(projectId, mergedMemory, now, now);
    }
    const dedup = deduplicateBacklog(db, projectId);
    const applied = applyConfirmedFactsToBacklog(db, projectId, mergedMemory);
    return NextResponse.json({
      description,
      memory: mergedMemory,
      generated: false,
      dedup,
      qa_autofill: applied,
    });
  }

  const description = {
    description_es: safeString(aiJson?.description_es),
    description_en: safeString(aiJson?.description_en),
  };
  const memory_update = safeString(aiJson?.memory_update);
  const mergedMemory = mergeProjectMemory(currentMemory, memory_update);

  if (!description.description_es && !description.description_en) {
    return NextResponse.json(
      { error: "La IA no devolvió una descripción válida." },
      { status: 500 },
    );
  }

  db.prepare("UPDATE projects SET description = ? WHERE id = ?").run(
    JSON.stringify(description),
    projectId,
  );

  if (mergedMemory) {
    const now = new Date().toISOString();
    const existing = db
      .prepare("SELECT project_id FROM project_memory WHERE project_id = ?")
      .get(projectId);
    if (existing) {
      db.prepare("UPDATE project_memory SET memory = ?, updated_at = ? WHERE project_id = ?").run(
        mergedMemory,
        now,
        projectId,
      );
    } else {
      db.prepare(
        "INSERT INTO project_memory (project_id, memory, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).run(projectId, mergedMemory, now, now);
    }
  }

  const dedup = deduplicateBacklog(db, projectId);
  const applied = applyConfirmedFactsToBacklog(db, projectId, mergedMemory || currentMemory);
  const qaDedupe = await dedupeQuestionsAcrossProject(db, projectId);

  return NextResponse.json({
    description,
    memory: mergedMemory || currentMemory,
    generated: true,
    dedup,
    qa_autofill: applied,
    qa_dedupe: qaDedupe,
  });
}
