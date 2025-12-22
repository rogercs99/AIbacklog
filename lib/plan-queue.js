import { getDb, updatePlanJob } from "@/lib/db";
import { generatePlan } from "@/lib/plan-generation";

const WORKER_KEY = "__req2backlog_plan_queue_worker__";

function safeParseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeError(error) {
  if (!error) {
    return "Error desconocido.";
  }
  if (typeof error === "string") {
    return error;
  }
  return error.message || "Error desconocido.";
}

async function processOneJob(state) {
  if (state.processing) {
    return;
  }
  state.processing = true;

  try {
    const db = getDb();
    const job = db
      .prepare("SELECT * FROM plan_jobs WHERE status = 'queued' ORDER BY id ASC LIMIT 1")
      .get();
    if (!job) {
      return;
    }

    const now = new Date().toISOString();
    const claimed = db
      .prepare(
        "UPDATE plan_jobs SET status = 'running', started_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'",
      )
      .run(now, now, job.id);
    if (!claimed?.changes) {
      return;
    }

    try {
      const payload = safeParseJson(job.payload_json, {}) || {};
      const result = await generatePlan({
        text: payload.text,
        version: payload.version,
        context: payload.context,
        projectId: payload.projectId || job.project_id,
      });

      updatePlanJob(job.id, {
        status: "done",
        result_json: JSON.stringify(result),
        error: null,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      updatePlanJob(job.id, {
        status: "error",
        error: normalizeError(error),
        finished_at: new Date().toISOString(),
      });
    }
  } finally {
    state.processing = false;
  }
}

function resetStaleRunningJobs() {
  const db = getDb();
  const running = db
    .prepare("SELECT id, started_at FROM plan_jobs WHERE status = 'running'")
    .all();
  if (!running.length) {
    return;
  }
  const now = Date.now();
  running.forEach((job) => {
    const started = job.started_at ? Date.parse(job.started_at) : NaN;
    if (!Number.isFinite(started)) {
      return;
    }
    const ageMs = now - started;
    if (ageMs > 15 * 60 * 1000) {
      updatePlanJob(job.id, {
        status: "queued",
        started_at: null,
        error: null,
      });
    }
  });
}

export function startPlanQueueWorker() {
  if (globalThis[WORKER_KEY]?.timer) {
    return globalThis[WORKER_KEY];
  }

  const state = {
    processing: false,
    timer: null,
  };

  resetStaleRunningJobs();

  processOneJob(state);

  state.timer = setInterval(() => {
    processOneJob(state);
  }, 1000);

  globalThis[WORKER_KEY] = state;
  return state;
}

export async function processPlanQueueOnce() {
  const state = globalThis[WORKER_KEY] || { processing: false, timer: null };
  await processOneJob(state);
  globalThis[WORKER_KEY] = state;
  return state;
}
