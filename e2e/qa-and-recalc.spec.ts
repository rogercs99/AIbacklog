import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const sample = (file: string) => fs.readFileSync(path.join(__dirname, "..", "samples", file), "utf8");

test("responde preguntas y recalcula contexto", async ({ request }) => {
  const projectName = `E2E QA ${Date.now()}`;
  const createProject = await request.post("/api/projects", { data: { name: projectName } });
  const { project } = await createProject.json();
  expect(project?.id).toBeTruthy();

  const plan = await request.post("/api/plan", {
    data: {
      text: sample("peliculas_v1.txt"),
      projectId: project.id,
      context: "Gestión de catálogo de películas y compras de licencias.",
      version: "v1",
    },
  });
  expect(plan.ok()).toBeTruthy();

  const detailRes = await request.get(`/api/projects/${project.id}`);
  const detail = await detailRes.json();
  const ensureTasks = async () => {
    let tasks =
      detail.backlog?.filter((item: any) => String(item.type || "").toLowerCase() === "task") || [];
    if (tasks.length > 0) return tasks;

    await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Epic",
          title: "Catálogo películas",
          area: "backend",
          priority: "High",
          status: "todo",
        },
      },
    });
    const epicListRes = await request.get(`/api/backlog?projectId=${project.id}`);
    const epicList = (await epicListRes.json()).items?.filter(
      (it: any) => String(it.type || "").toLowerCase() === "epic",
    );
    const epicId = epicList?.[0]?.id || null;

    await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Story",
          title: "Ingesta de proveedores",
          area: "backend",
          priority: "High",
          status: "todo",
          parent_id: epicId,
        },
      },
    });
    const storiesRes = await request.get(`/api/backlog?projectId=${project.id}`);
    const storyList = (await storiesRes.json()).items?.filter(
      (it: any) => String(it.type || "").toLowerCase() === "story",
    );
    const storyId = storyList?.[0]?.id || epicId || null;

    await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Task",
          title: "Procesar ficheros EPG",
          area: "backend",
          priority: "High",
          status: "todo",
          parent_id: storyId,
        },
      },
    });
    const refetch = await request.get(`/api/backlog?projectId=${project.id}`);
    const items = (await refetch.json()).items || [];
    return items.filter((item: any) => String(item.type || "").toLowerCase() === "task");
  };

  const tasks = await ensureTasks();
  if (tasks.length === 0) {
    test.skip(true, "No hay tareas disponibles tras la generación y el sembrado mínimo.");
  }

  const target = tasks[0];
  const newQa = [
    "Q: ¿Qué proveedor de streaming usamos? | A: Usamos proveedor interno con DRM propio.",
    "Q: ¿Frecuencia de actualizaciones de catálogo? | A: Semanal, cada lunes 09:00.",
  ];

  const patchRes = await request.patch(`/api/backlog/${target.id}`, {
    data: {
      updates: {
        clarification_questions: newQa,
      },
    },
  });
  expect(patchRes.ok()).toBeTruthy();
  const patchPayload = await patchRes.json();
  expect(patchPayload?.item?.clarification_questions?.length || 0).toBeGreaterThan(0);

  // Recalcular proyecto para propagar contexto
  const recalc = await request.post(`/api/projects/${project.id}/recalculate`);
  expect(recalc.ok()).toBeTruthy();
  const recalcPayload = await recalc.json();
  expect(recalcPayload?.description).toBeTruthy();
});
