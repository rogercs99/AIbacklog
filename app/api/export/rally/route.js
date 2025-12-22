import { NextResponse } from "next/server";
import { buildRallyCsv } from "@/lib/exports";
import { getDefaultProject, getProjectById, listBacklogItems } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonField(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("projectId"));
  let project = null;
  if (projectId) {
    project = getProjectById(projectId);
  }
  if (!project) {
    project = getDefaultProject();
  }
  const rawItems = listBacklogItems(project.id);
  const idMap = new Map(rawItems.map((item) => [item.id, item.external_id]));

  const items = rawItems.map((item) => ({
    ...item,
    acceptance_criteria: parseJsonField(item.acceptance_criteria_json),
    dependencies: parseJsonField(item.dependencies_json),
    risks: parseJsonField(item.risks_json),
    labels: parseJsonField(item.labels_json),
    parent_external_id: item.parent_id ? idMap.get(item.parent_id) : null,
  }));

  const csv = buildRallyCsv(items);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=req2backlog_rally.csv",
    },
  });
}
