import { NextResponse } from "next/server";
import {
  findBacklogItemByExternalId,
  getDb,
  getDefaultProject,
  insertChange,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeType(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("epic") || raw.includes("epica") || raw.includes("epica")) {
    return "Epic";
  }
  if (raw.includes("story") || raw.includes("historia")) {
    return "Story";
  }
  if (raw.includes("task") || raw.includes("tarea")) {
    return "Task";
  }
  return "Story";
}

function ensureParentLinks(rawItems, existingEpics) {
  const items = (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
    ...item,
    type: normalizeType(item.type),
  }));
  if (items.length === 0) {
    return items;
  }

  const existingIds = new Set(
    (existingEpics || [])
      .map((epic) => epic.external_id)
      .filter(Boolean),
  );
  items.forEach((item) => {
    if (item.external_id) {
      existingIds.add(item.external_id);
    }
  });

  let counter = 1;
  const nextId = () => {
    let id = "";
    do {
      id = `T-${String(counter++).padStart(3, "0")}`;
    } while (existingIds.has(id));
    return id;
  };

  items.forEach((item) => {
    if (!item.external_id) {
      const id = nextId();
      item.external_id = id;
      existingIds.add(id);
    }
  });

  let epics = items.filter((item) => item.type === "Epic");
  if (epics.length === 0 && (!existingEpics || existingEpics.length === 0)) {
    const epicExternalId = nextId();
    const epicItem = {
      external_id: epicExternalId,
      type: "Epic",
      parent_external_id: null,
      title: "Subproyecto general",
      description: "Agrupa tareas sin subproyecto especifico.",
      area: "other",
      priority: "Medium",
      status: "todo",
    };
    items.unshift(epicItem);
    epics = [epicItem];
    existingIds.add(epicExternalId);
  }

  const epicBySource = new Map();
  [...(existingEpics || []), ...epics].forEach((epic) => {
    if (epic.source_chunk_id) {
      epicBySource.set(epic.source_chunk_id, epic.external_id);
    }
  });
  const defaultEpicExternalId =
    epics[0]?.external_id || existingEpics?.[0]?.external_id || null;

  items.forEach((item) => {
    if (item.type === "Epic") {
      item.parent_external_id = null;
      return;
    }
    if (item.parent_external_id && !existingIds.has(item.parent_external_id)) {
      item.parent_external_id = null;
    }
    if (!item.parent_external_id) {
      const fromSource = item.source_chunk_id
        ? epicBySource.get(item.source_chunk_id)
        : null;
      item.parent_external_id = fromSource || defaultEpicExternalId || null;
    }
    if (!Array.isArray(item.clarification_questions)) {
      item.clarification_questions = [];
    }
  });

  return items;
}

export async function POST(request) {
  const body = await request.json();
  const actions = body?.actions || {};
  const fromVersion = body?.from_version || null;
  const toVersion = body?.to_version || null;

  const project = getDefaultProject();
  const db = getDb();

  const createItemsInput = Array.isArray(actions.create_items) ? actions.create_items : [];
  const updateItems = Array.isArray(actions.update_items) ? actions.update_items : [];
  const obsoleteItems = Array.isArray(actions.mark_obsolete) ? actions.mark_obsolete : [];
  const questions = Array.isArray(actions.questions_for_client)
    ? actions.questions_for_client
    : [];
  const existingEpics = db
    .prepare(
      "SELECT id, external_id, source_chunk_id FROM backlog_items WHERE project_id = ? AND lower(type) = 'epic' ORDER BY id ASC",
    )
    .all(project.id);
  const createItems = ensureParentLinks(createItemsInput, existingEpics);

  const insert = db.prepare(`
    INSERT INTO backlog_items (
      project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
      story_points, estimate_hours, status, acceptance_criteria_json, dependencies_json,
      risks_json, labels_json, clarification_questions_json, source_chunk_id, source_snippet, updated_at
    ) VALUES (
      @project_id, @external_id, @type, @parent_id, @epic_key, @title, @description, @area,
      @priority, @story_points, @estimate_hours, @status, @acceptance_criteria_json,
      @dependencies_json, @risks_json, @labels_json, @clarification_questions_json, @source_chunk_id, @source_snippet, @updated_at
    )
  `);
  const updateParent = db.prepare(
    "UPDATE backlog_items SET parent_id = ?, epic_key = ? WHERE id = ?",
  );

  const externalMap = new Map(
    existingEpics.map((epic) => [epic.external_id, epic.id]),
  );
  const pendingParents = [];
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    createItems.forEach((item) => {
      const info = insert.run({
        project_id: project.id,
        external_id: item.external_id,
        type: item.type,
        parent_id: null,
        epic_key: null,
        title: item.title,
        description: item.description || "",
        area: item.area || "other",
        priority: item.priority || "Medium",
        story_points: item.story_points ?? null,
        estimate_hours: item.estimate_hours ?? null,
        status: item.status || "todo",
        acceptance_criteria_json: JSON.stringify(item.acceptance_criteria || []),
        dependencies_json: JSON.stringify(item.dependencies || []),
        risks_json: JSON.stringify(item.risks || []),
        labels_json: JSON.stringify(item.labels || []),
        clarification_questions_json: JSON.stringify(item.clarification_questions || []),
        source_chunk_id: item.source_chunk_id || null,
        source_snippet: item.source_snippet || null,
        updated_at: now,
      });
      externalMap.set(item.external_id, info.lastInsertRowid);
      if (item.parent_external_id) {
        pendingParents.push({
          childId: info.lastInsertRowid,
          parentExternalId: item.parent_external_id,
        });
      }
      insertChange(project.id, {
        from_version: fromVersion,
        to_version: toVersion,
        change_type: "create",
        summary: item.title,
        affected_items_json: JSON.stringify({ external_id: item.external_id }),
      });
    });

    pendingParents.forEach((pending) => {
      const parentId = externalMap.get(pending.parentExternalId);
      if (parentId) {
        updateParent.run(parentId, pending.parentExternalId, pending.childId);
      }
    });

    updateItems.forEach((item) => {
      const existing = findBacklogItemByExternalId(project.id, item.external_id);
      if (!existing) {
        return;
      }
      const patch = item.patch || {};
      const updates = {
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        area: patch.area ?? existing.area,
        priority: patch.priority ?? existing.priority,
        story_points: patch.story_points ?? existing.story_points,
        estimate_hours: patch.estimate_hours ?? existing.estimate_hours,
        status: patch.status ?? existing.status,
        acceptance_criteria_json: patch.acceptance_criteria
          ? JSON.stringify(patch.acceptance_criteria)
          : existing.acceptance_criteria_json,
        dependencies_json: patch.dependencies
          ? JSON.stringify(patch.dependencies)
          : existing.dependencies_json,
        risks_json: patch.risks ? JSON.stringify(patch.risks) : existing.risks_json,
        labels_json: patch.labels ? JSON.stringify(patch.labels) : existing.labels_json,
        clarification_questions_json: patch.clarification_questions
          ? JSON.stringify(patch.clarification_questions)
          : existing.clarification_questions_json,
        source_snippet: patch.source_snippet ?? existing.source_snippet,
      };
      const fields = Object.keys(updates);
      const values = fields.map((field) => updates[field]);
      values.push(new Date().toISOString());
      values.push(existing.id);
      db.prepare(
        `UPDATE backlog_items SET ${fields
          .map((field) => `${field} = ?`)
          .join(", ")}, updated_at = ? WHERE id = ?`,
      ).run(values);

      insertChange(project.id, {
        from_version: fromVersion,
        to_version: toVersion,
        change_type: "update",
        summary: item.external_id,
        affected_items_json: JSON.stringify({ patch }),
      });
    });

    obsoleteItems.forEach((externalId) => {
      const existing = findBacklogItemByExternalId(project.id, externalId);
      if (!existing) {
        return;
      }
      db.prepare("UPDATE backlog_items SET status = ?, updated_at = ? WHERE id = ?").run(
        "obsolete",
        new Date().toISOString(),
        existing.id,
      );
      insertChange(project.id, {
        from_version: fromVersion,
        to_version: toVersion,
        change_type: "obsolete",
        summary: externalId,
        affected_items_json: null,
      });
    });

    questions.forEach((question) => {
      insertChange(project.id, {
        from_version: fromVersion,
        to_version: toVersion,
        change_type: "question",
        summary: question.question,
        affected_items_json: JSON.stringify({
          priority: question.priority,
          reason: question.reason,
        }),
      });
    });
  });

  tx();

  return NextResponse.json({
    created: createItems.length,
    updated: updateItems.length,
    obsolete: obsoleteItems.length,
    questions: questions.length,
  });
}
