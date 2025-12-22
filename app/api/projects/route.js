import { NextResponse } from "next/server";
import { createProject, getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        p.*, 
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) AS documents_count,
        (SELECT COUNT(*) FROM backlog_items WHERE project_id = p.id) AS backlog_count,
        (SELECT COUNT(*) FROM plan_jobs WHERE project_id = p.id AND status IN ('queued','processing')) AS pending_plan_jobs,
        (SELECT MAX(created_at) FROM documents WHERE project_id = p.id) AS last_document_at,
        (SELECT MAX(updated_at) FROM backlog_items WHERE project_id = p.id) AS last_backlog_at
      FROM projects p
      ORDER BY p.created_at DESC
    `,
    )
    .all();

  const projects = rows.map((row) => {
    const lastActivity = [row.last_document_at, row.last_backlog_at, row.created_at]
      .filter(Boolean)
      .sort()
      .pop();
    return {
      ...row,
      documents_count: row.documents_count || 0,
      backlog_count: row.backlog_count || 0,
      pending_plan_jobs: row.pending_plan_jobs || 0,
      last_activity: lastActivity,
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(request) {
  const body = await request.json();
  const name = (body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
  }
  const project = createProject(name);
  return NextResponse.json({ project });
}
