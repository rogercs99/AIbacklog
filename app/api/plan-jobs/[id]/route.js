import { NextResponse } from "next/server";
import { getPlanJob } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeParseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function GET(request, { params }) {
  const jobId = Number(params?.id);
  if (!jobId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const job = getPlanJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job no encontrado." }, { status: 404 });
  }

  const payload = safeParseJson(job.payload_json, {}) || {};
  if (payload && typeof payload === "object" && "text" in payload) {
    delete payload.text;
  }

  const result = safeParseJson(job.result_json, null);

  return NextResponse.json({
    job: {
      id: job.id,
      projectId: job.project_id,
      status: job.status,
      error: job.error || "",
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
      payload,
      result,
    },
  });
}

