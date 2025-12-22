import { NextResponse } from "next/server";
import {
  getDb,
  updateBacklogItem,
  getNextExternalId,
  insertBacklogItems,
  getLatestDocument,
} from "@/lib/db";
import { callAI } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const id = Number(params?.id);
  if (!id) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT id, type, project_id FROM backlog_items WHERE id = ? LIMIT 1")
    .get(id);
  if (!existing) {
    return NextResponse.json({ error: "No existe el item." }, { status: 404 });
  }
  const body = await request.json();
  const updates = body?.updates;
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Actualizacion invalida." }, { status: 400 });
  }

  const payload = { ...updates };
  const typeLower = String(payload.type || existing.type || "").toLowerCase();

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
        .get(parentId, existing.project_id);

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
              .get(parent.parent_id, existing.project_id);
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

  const updated = db
    .prepare("SELECT * FROM backlog_items WHERE id = ? LIMIT 1")
    .get(id);

  // Regenerar descripción a partir de las respuestas y, si aplica, crear nuevos subitems.
  const clarificationList = Array.isArray(updates?.clarification_questions)
    ? updates.clarification_questions
    : (() => {
        try {
          return JSON.parse(updated?.clarification_questions_json || "[]");
        } catch (err) {
          return [];
        }
      })();

  let regeneratedDescription = updated?.description || "";
  let regeneratedQuestions = clarificationList;
  const newItems = [];

  const latestDoc = getLatestDocument(existing.project_id);
  const contextSnippet = latestDoc?.text ? String(latestDoc.text).slice(0, 1200) : "";

  const qaBlock = clarificationList
    .map((entry, idx) => `#${idx + 1} ${entry}`)
    .join("\n");

  const system =
    "Eres un analista funcional senior. Devuelve solo JSON válido. Usa las respuestas de aclaraciones para enriquecer la descripción (Markdown breve y clara) y, si surgen nuevas tareas/historias, propónlas como new_items.";
  const user = [
    `ITEM:`,
    `- tipo: ${updated.type}`,
    `- titulo: ${updated.title}`,
    `- area: ${updated.area || "other"}`,
    `- descripcion_actual: ${updated.description || "N/A"}`,
    `- snippet_fuente: ${updated.source_snippet || contextSnippet || "N/A"}`,
    `PREGUNTAS/RESPUESTAS:`,
    qaBlock || "N/A",
    `OUTPUT JSON:`,
    `{"description":"... markdown ...","clarification_questions":["Q: ... | A: ..."],"new_items":[{"title":"...","type":"Task|Story","area":"frontend|backend|api|db|qa|devops|security|other","priority":"High|Medium|Low","description":"...","acceptance_criteria":["..."],"risks":["..."],"labels":["..."]}]}`,
    `REGLAS:`,
    `- Usa solo la información presente.`,
    `- Si no hay nuevas acciones, deja new_items como [].`,
    `- La descripción debe ser entendible para público no técnico (2-4 frases + bullets si ayuda).`,
    `- No menciones modelos ni IA.`,
  ].join("\n");

  try {
    const ai = await callAI({ system, user, maxTokens: 750, temperature: 0.2 });
    if (ai?.description) {
      regeneratedDescription = ai.description;
    }
    if (Array.isArray(ai?.clarification_questions)) {
      regeneratedQuestions = ai.clarification_questions;
    }
    if (Array.isArray(ai?.new_items)) {
      newItems.push(
        ...ai.new_items
          .filter((it) => it && it.title)
          .slice(0, 10), // limite defensivo
      );
    }
  } catch (err) {
    // fallback silencioso
  }

  updateBacklogItem(id, {
    description: regeneratedDescription,
    clarification_questions_json: JSON.stringify(regeneratedQuestions || []),
  });

  // Crear nuevos sub-items si se propusieron
  if (newItems.length) {
    let nextId = getNextExternalId(existing.project_id);
    let counter = Number(nextId.replace(/[^0-9]/g, "")) || 1;
    const nextExternalId = () => {
      const id = `T-${String(counter).padStart(3, "0")}`;
      counter += 1;
      return id;
    };

    const existingType = String(existing.type || "").toLowerCase();

    const resolveParent = (newTypeLower) => {
      if (newTypeLower === "story") {
        if (existingType === "epic") {
          return { parent_id: existing.id, epic_key: existing.external_id };
        }
        return { parent_id: existing.parent_id || existing.id || null, epic_key: existing.epic_key || null };
      }
      // task por defecto
      if (existingType === "story") {
        return { parent_id: existing.id, epic_key: existing.epic_key || null };
      }
      if (existingType === "epic") {
        return { parent_id: existing.id, epic_key: existing.external_id };
      }
      return { parent_id: existing.parent_id || existing.id || null, epic_key: existing.epic_key || null };
    };

    const rows = newItems.map((item) => {
      const newTypeLower = String(item.type || "Task").toLowerCase();
      const parentInfo = resolveParent(newTypeLower);
      return {
        external_id: nextExternalId(),
        type: newTypeLower === "story" ? "Story" : "Task",
        parent_id: parentInfo.parent_id,
        epic_key: parentInfo.epic_key,
        title: item.title,
        description: item.description || item.title,
        area: item.area || existing.area || "other",
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
    insertBacklogItems(existing.project_id, rows);
  }

  return NextResponse.json({
    ok: true,
    item: {
      ...updated,
      description: regeneratedDescription,
      clarification_questions: regeneratedQuestions,
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
