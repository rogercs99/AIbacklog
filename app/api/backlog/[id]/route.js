import { NextResponse } from "next/server";
import {
  getDb,
  updateBacklogItem,
  getNextExternalId,
  insertBacklogItems,
  getLatestDocument,
} from "@/lib/db";
import { callAI } from "@/lib/ai";
import { extractAnsweredFacts, mergeQaLists, parseQaList, serializeQaList } from "@/lib/qa";

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

function stripTypePrefix(value = "") {
  return String(value || "")
    .replace(
      /^(us|u\.s\.?|user\s*story|historia|feature|fe|task|tarea|epic|épica|epica)[:.\-\s]+/i,
      "",
    )
    .replace(/\s*\(\d+\)\s*$/g, "")
    .trim();
}

function mergeFactsIntoDescription(description = "", facts = []) {
  const clean = String(description || "").trim();
  if (!facts.length) {
    return clean;
  }
  const factLines = facts.map((fact) => `- ${fact}`);
  const heading = "**Información confirmada**";

  if (!clean) {
    return [heading, ...factLines].join("\n");
  }

  if (clean.includes(heading)) {
    const existingLines = new Set(clean.split("\n").map((line) => line.trim()));
    const additions = factLines.filter((line) => !existingLines.has(line.trim()));
    if (!additions.length) {
      return clean;
    }
    return `${clean}\n${additions.join("\n")}`;
  }

  return `${clean}\n\n${heading}\n${factLines.join("\n")}`;
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

function propagateAnswersToSiblings(db, projectId, sourceItemId, qaList, now) {
  const answered = parseQaList(qaList).filter((qa) => qa.answer);
  if (!answered.length) return { touched: 0, updated_descriptions: 0 };

  const rows = db
    .prepare(
      "SELECT id, description, description_history_json, updated_at, clarification_questions_json FROM backlog_items WHERE project_id = ? AND id != ?",
    )
    .all(projectId, sourceItemId);

  const update = db.prepare(
    "UPDATE backlog_items SET clarification_questions_json = ?, description = ?, description_history_json = ?, updated_at = ? WHERE id = ?",
  );

  let touched = 0;
  let updatedDescriptions = 0;

  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const list = parseQaList(row.clarification_questions_json || []);
      let changed = false;
      const appliedFacts = [];
      list.forEach((qa) => {
        if (qa.answer) return;
        const match = answered.find((fact) => isSimilarQuestion(fact.question, qa.question));
        if (match) {
          qa.answer = match.answer;
          changed = true;
          appliedFacts.push(`${qa.question}: ${match.answer}`);
        }
      });
      if (!changed) return;
      const nextQuestions = serializeQaList(list);
      const nextDescription = mergeFactsIntoDescription(row.description || "", appliedFacts);
      const prevHistory = parseJson(row.description_history_json, []);
      const nextHistory = appendHistory(
        prevHistory.length ? prevHistory : [{ source: "ingest", text: row.description || "", at: row.updated_at || now }],
        { source: "qa-propagated-sibling", text: nextDescription, at: now },
      );
      if (nextDescription !== String(row.description || "").trim()) {
        updatedDescriptions += 1;
      }
      update.run(JSON.stringify(nextQuestions), nextDescription, JSON.stringify(nextHistory), now, row.id);
      touched += 1;
    });
  });
  tx();

  return { touched, updated_descriptions: updatedDescriptions };
}

export async function PATCH(request, { params }) {
  const id = Number(params?.id);
  if (!id) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }
  const db = getDb();
  const before = db
    .prepare(
      "SELECT id, type, project_id, external_id, parent_id, epic_key, title, description, clarification_questions_json, description_history_json, updated_at FROM backlog_items WHERE id = ? LIMIT 1",
    )
    .get(id);
  if (!before) {
    return NextResponse.json({ error: "No existe el item." }, { status: 404 });
  }
  const body = await request.json();
  const updates = body?.updates;
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Actualizacion invalida." }, { status: 400 });
  }

  const payload = { ...updates };
  const typeLower = String(payload.type || before.type || "").toLowerCase();
  if ("info_complete" in payload) {
    payload.info_complete = payload.info_complete ? 1 : 0;
  }

  if (payload.acceptance_criteria) {
    payload.acceptance_criteria_json = JSON.stringify(payload.acceptance_criteria);
    delete payload.acceptance_criteria;
  }
  if (payload.dependencies) {
    payload.dependencies_json = JSON.stringify(payload.dependencies);
    delete payload.dependencies;
  }
  if (payload.risks) {
    payload.risks_json = JSON.stringify(payload.risks);
    delete payload.risks;
  }
  if (payload.labels) {
    payload.labels_json = JSON.stringify(payload.labels);
    delete payload.labels;
  }
  if (payload.clarification_questions) {
    payload.clarification_questions_json = JSON.stringify(payload.clarification_questions);
    delete payload.clarification_questions;
  }

  if ("parent_id" in payload) {
    const parentIdRaw = payload.parent_id;
    const parentId =
      parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ""
        ? null
        : Number(parentIdRaw);

    if (typeLower === "epic") {
      payload.parent_id = null;
      payload.epic_key = null;
    } else if (!parentId) {
      payload.parent_id = null;
      payload.epic_key = null;
    } else {
      const parent = db
        .prepare(
          "SELECT id, type, external_id, epic_key, parent_id FROM backlog_items WHERE id = ? AND project_id = ? LIMIT 1",
        )
        .get(parentId, before.project_id);

      const parentType = String(parent?.type || "").toLowerCase();

      if (typeLower === "story") {
        if (parent && parentType === "epic") {
          payload.parent_id = parent.id;
          payload.epic_key = parent.external_id;
        } else {
          payload.parent_id = null;
          payload.epic_key = null;
        }
      } else if (typeLower === "task") {
        if (parent && parentType === "story") {
          payload.parent_id = parent.id;
          payload.epic_key = parent.epic_key || null;
          if (!payload.epic_key && parent.parent_id) {
            const epic = db
              .prepare(
                "SELECT external_id FROM backlog_items WHERE id = ? AND project_id = ? LIMIT 1",
              )
              .get(parent.parent_id, before.project_id);
            payload.epic_key = epic?.external_id || null;
          }
        } else if (parent && parentType === "epic") {
          // fallback: permitir colgar del Epic (quedará como US sin feature)
          payload.parent_id = parent.id;
          payload.epic_key = parent.external_id;
        } else {
          payload.parent_id = null;
          payload.epic_key = null;
        }
      }
    }
  }

  updateBacklogItem(id, payload);

  const updated = db.prepare("SELECT * FROM backlog_items WHERE id = ? LIMIT 1").get(id);
  const now = new Date().toISOString();
  const baseHistory = (() => {
    const parsed = parseJson(updated?.description_history_json, []);
    if (parsed.length) return parsed;
    if (before?.description) {
      return [{ source: "ingest", text: before.description, at: before.updated_at || now }];
    }
    return [];
  })();

  // Regenerar descripción a partir de las respuestas y, si aplica, crear nuevos subitems.
  const userProvidedQa = Array.isArray(updates?.clarification_questions);
  const clarificationList = userProvidedQa
    ? updates.clarification_questions
    : (() => {
        try {
          return JSON.parse(updated?.clarification_questions_json || "[]");
        } catch (err) {
          return [];
        }
      })();

  let regeneratedDescription = updated?.description || "";
  let regeneratedQuestions = serializeQaList(clarificationList);
  const newItems = [];
  const beforeQuestions = serializeQaList(parseJson(before?.clarification_questions_json, []));
  const qaChanged = userProvidedQa && JSON.stringify(beforeQuestions) !== JSON.stringify(regeneratedQuestions);

  const latestDoc = getLatestDocument(before.project_id);
  const contextSnippet = latestDoc?.text ? String(latestDoc.text).slice(0, 1200) : "";

  const qaBlock = regeneratedQuestions.map((entry, idx) => `#${idx + 1} ${entry}`).join("\n");

  if (qaChanged) {
    const system =
      "Eres un analista funcional senior. Devuelve solo JSON válido. Usa las respuestas confirmadas para mejorar la descripción sin borrar información previa ni perder preguntas ya respondidas.";
    const user = [
      `ITEM:`,
      `- tipo: ${updated.type}`,
      `- titulo: ${updated.title}`,
      `- area: ${updated.area || "other"}`,
      `- descripcion_actual: ${updated.description || "N/A"}`,
      `- snippet_fuente: ${updated.source_snippet || contextSnippet || "N/A"}`,
      `PREGUNTAS/RESPUESTAS (mantener las respondidas):`,
      qaBlock || "N/A",
      `OUTPUT JSON:`,
      `{"description":"... markdown ...","suggested_questions":["..."],"new_items":[{"title":"...","type":"Task|Story","area":"frontend|backend|api|db|qa|devops|security|other","priority":"High|Medium|Low","description":"...","acceptance_criteria":["..."],"risks":["..."],"labels":["..."]}]}`,
      `REGLAS:`,
      `- NO inventes. Si falta algo, proponlo como pregunta sugerida.`,
      `- NO devuelvas preguntas ya presentes en PREGUNTAS/RESPUESTAS.`,
      `- No borres información de la descripción actual: intégrala.`,
      `- new_items solo si se deriva claramente del contexto y las respuestas.`,
      `- No menciones modelos ni IA.`,
    ].join("\n");

    try {
      const ai = await callAI({ system, user, maxTokens: 750, temperature: 0.2 });
      if (typeof ai?.description === "string" && ai.description.trim().length >= 60 && !/^Q[:=]/i.test(ai.description.trim())) {
        regeneratedDescription = ai.description.trim();
      }
      const suggested = Array.isArray(ai?.suggested_questions)
        ? ai.suggested_questions
        : Array.isArray(ai?.clarification_questions)
          ? ai.clarification_questions
          : [];
      const mergedQa = mergeQaLists(regeneratedQuestions, suggested);
      regeneratedQuestions = serializeQaList(mergedQa);
      if (Array.isArray(ai?.new_items)) {
        newItems.push(
          ...ai.new_items
            .filter((it) => it && it.title)
            .slice(0, 10),
        );
      }
    } catch (err) {
      // fallback silencioso
    }

    const nextHistory = appendHistory(baseHistory, {
      source: "qa",
      text: regeneratedDescription || updated?.description || "",
      at: now,
    });

    updateBacklogItem(id, {
      description: regeneratedDescription,
      clarification_questions_json: JSON.stringify(regeneratedQuestions || []),
      description_history_json: JSON.stringify(nextHistory),
    });

    // Propagar hechos confirmados a iniciativa/feature padre y a la memoria del proyecto
    const facts = extractAnsweredFacts(regeneratedQuestions);
    if (facts.length) {
      const memoryRow = db
        .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
        .get(before.project_id);
      const existingMemory = String(memoryRow?.memory || "").trim();
      const lines = existingMemory ? existingMemory.split("\n") : [];
      const heading = "HECHOS CONFIRMADOS:";
      if (!lines.some((line) => line.trim().toUpperCase() === heading)) {
        lines.push(heading);
      }
      facts.forEach((fact) => {
        const line = `- ${fact}`;
        if (!lines.includes(line)) {
          lines.push(line);
        }
      });
      const trimmed = lines.slice(-80).join("\n");
      const existingRow = db
        .prepare("SELECT project_id FROM project_memory WHERE project_id = ? LIMIT 1")
        .get(before.project_id);
      if (existingRow) {
        db.prepare("UPDATE project_memory SET memory = ?, updated_at = ? WHERE project_id = ?").run(
          trimmed,
          now,
          before.project_id,
        );
      } else {
        db.prepare(
          "INSERT INTO project_memory (project_id, memory, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ).run(before.project_id, trimmed, now, now);
      }

      const parentIds = [];
      if (updated?.parent_id) {
        parentIds.push(Number(updated.parent_id));
      }
      if (updated?.epic_key) {
        const epic = db
          .prepare("SELECT id FROM backlog_items WHERE project_id = ? AND external_id = ? LIMIT 1")
          .get(before.project_id, updated.epic_key);
        if (epic?.id) {
          parentIds.push(Number(epic.id));
        }
      }
      const uniqueParents = Array.from(new Set(parentIds)).filter(Boolean);
      uniqueParents.forEach((pid) => {
        const parentItem = db
          .prepare("SELECT id, description, description_history_json, updated_at FROM backlog_items WHERE id = ? AND project_id = ?")
          .get(pid, before.project_id);
        if (!parentItem) return;
        const parentHistory = parseJson(parentItem.description_history_json, []);
        const mergedDesc = mergeFactsIntoDescription(parentItem.description || "", facts);
        const nextParentHistory = appendHistory(parentHistory.length ? parentHistory : [{ source: "ingest", text: parentItem.description || "", at: parentItem.updated_at || now }], {
          source: "qa-propagated",
          text: mergedDesc,
          at: now,
        });
        updateBacklogItem(pid, {
          description: mergedDesc,
          description_history_json: JSON.stringify(nextParentHistory),
        });
      });
    }

    // Propagar respuestas a otros items con la misma pregunta (misma redacción)
    propagateAnswersToSiblings(db, before.project_id, id, regeneratedQuestions, now);
  }

  // Si no hubo cambios en QA, aseguramos guardar las respuestas actuales y reflejar hechos en la descripción.
  if (!qaChanged) {
    const facts = extractAnsweredFacts(regeneratedQuestions);
    const mergedDesc = mergeFactsIntoDescription(regeneratedDescription || updated?.description || "", facts);
    const nextHistory = appendHistory(baseHistory, {
      source: "qa",
      text: mergedDesc || updated?.description || "",
      at: now,
    });
    updateBacklogItem(id, {
      description: mergedDesc,
      clarification_questions_json: JSON.stringify(regeneratedQuestions || []),
      description_history_json: JSON.stringify(nextHistory),
    });
    if (facts.length) {
      propagateAnswersToSiblings(db, before.project_id, id, regeneratedQuestions, now);
    }
  }

  // Crear nuevos sub-items si se propusieron
  if (newItems.length) {
    let nextId = getNextExternalId(before.project_id);
    let counter = Number(nextId.replace(/[^0-9]/g, "")) || 1;
    const nextExternalId = () => {
      const id = `T-${String(counter).padStart(3, "0")}`;
      counter += 1;
      return id;
    };

    const existingType = String(before.type || "").toLowerCase();

    const resolveParent = (newTypeLower) => {
      if (newTypeLower === "story") {
        if (existingType === "epic") {
          return { parent_id: before.id, epic_key: before.external_id };
        }
        return { parent_id: before.parent_id || before.id || null, epic_key: before.epic_key || null };
      }
      // task por defecto
      if (existingType === "story") {
        return { parent_id: before.id, epic_key: before.epic_key || null };
      }
      if (existingType === "epic") {
        return { parent_id: before.id, epic_key: before.external_id };
      }
      return { parent_id: before.parent_id || before.id || null, epic_key: before.epic_key || null };
    };

    const rows = newItems.map((item) => {
      const newTypeLower = String(item.type || "Task").toLowerCase();
      const parentInfo = resolveParent(newTypeLower);
      const title = stripTypePrefix(item.title);
      return {
        external_id: nextExternalId(),
        type: newTypeLower === "story" ? "Story" : "Task",
        parent_id: parentInfo.parent_id,
        epic_key: parentInfo.epic_key,
        title: title || item.title,
        description: item.description || item.title,
        area: item.area || before.area || "other",
        priority: item.priority || "Medium",
        story_points: null,
        estimate_hours: null,
        status: "todo",
        acceptance_criteria: Array.isArray(item.acceptance_criteria)
          ? item.acceptance_criteria
          : [],
        dependencies: [],
        risks: Array.isArray(item.risks) ? item.risks : [],
        labels: Array.isArray(item.labels) ? item.labels : [],
        clarification_questions: [],
        source_chunk_id: updated.source_chunk_id || null,
        source_snippet: updated.source_snippet || contextSnippet || "",
      };
    });
    insertBacklogItems(before.project_id, rows);
  }

  const finalItem = db.prepare("SELECT * FROM backlog_items WHERE id = ? LIMIT 1").get(id);

  return NextResponse.json({
    ok: true,
    item: {
      ...finalItem,
      description: userProvidedQa ? regeneratedDescription : finalItem?.description,
      clarification_questions: userProvidedQa
        ? regeneratedQuestions
        : parseJson(finalItem?.clarification_questions_json, []),
    },
    new_items_created: newItems.length,
  });
}

export async function DELETE(request, { params }) {
  const id = Number(params?.id);
  if (!id) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }
  const db = getDb();
  const item = db
    .prepare("SELECT id, type, project_id, parent_id, external_id, epic_key FROM backlog_items WHERE id = ?")
    .get(id);
  if (!item) {
    return NextResponse.json({ error: "No existe el item." }, { status: 404 });
  }
  const typeLower = String(item.type || "").toLowerCase();
  const isEpic = typeLower === "epic";
  const isStory = typeLower === "story";
  const tx = db.transaction(() => {
    if (isEpic) {
      db.prepare("UPDATE backlog_items SET parent_id = NULL, epic_key = NULL WHERE parent_id = ?").run(id);
    } else if (isStory) {
      // Si se elimina una Feature/Story, sus US/Tasks se reasignan al Epic padre (si existe).
      const epicParentId = item.parent_id ? Number(item.parent_id) : null;
      let epicKey = item.epic_key || null;
      if (!epicKey && epicParentId) {
        const epic = db
          .prepare(
            "SELECT external_id FROM backlog_items WHERE id = ? AND project_id = ? LIMIT 1",
          )
          .get(epicParentId, item.project_id);
        epicKey = epic?.external_id || null;
      }
      db.prepare("UPDATE backlog_items SET parent_id = ?, epic_key = ? WHERE parent_id = ?").run(
        epicParentId,
        epicKey,
        id,
      );
    }
    db.prepare("DELETE FROM backlog_items WHERE id = ?").run(id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
