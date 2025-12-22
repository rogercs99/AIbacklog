import { NextResponse } from "next/server";
import { createPlanJob, getDefaultProject, getProjectById } from "@/lib/db";
import { startPlanQueueWorker } from "@/lib/plan-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const text = String(body?.text || "").trim();
  const version = String(body?.version || "v1").trim() || "v1";
  const context = String(body?.context || "").trim();
  const projectId = Number(body?.projectId);

  if (!text) {
    return NextResponse.json({ error: "Documento vacío." }, { status: 400 });
  }

  let project = null;
  if (projectId) {
    project = getProjectById(projectId);
  }
  if (!project) {
    project = getDefaultProject();
  }

  const job = createPlanJob({
    projectId: project.id,
    payload: { text, version, context, projectId: project.id },
  });

  startPlanQueueWorker();

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    projectId: job.project_id,
  });
}

