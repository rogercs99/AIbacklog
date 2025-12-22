import { NextResponse } from "next/server";
import { getDb, updateBacklogItem } from "@/lib/db";

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

  return NextResponse.json({ ok: true });
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
