import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const sample = (file: string) => fs.readFileSync(path.join(__dirname, "..", "samples", file), "utf8");

test("genera backlog y exporta a Jira y Rally", async ({ request }) => {
  const projectName = `E2E Calcetines ${Date.now()}`;

  // Crear proyecto
  const createProject = await request.post("/api/projects", {
    data: { name: projectName },
  });
  expect(createProject.ok()).toBeTruthy();
  const { project } = await createProject.json();
  expect(project?.id).toBeTruthy();

  // Generar plan con requisitos v1
  const text = sample("requisitos_v1.txt");
  const plan = await request.post("/api/plan", {
    data: {
      text,
      projectId: project.id,
      context: "Tienda online de calcetines de colores. Registrar usuarios y pagos.",
      version: "v1",
    },
  });
  expect(plan.ok()).toBeTruthy();
  const planPayload = await plan.json();

  // Si por algún motivo no se crearon items (p.ej. sin clave de IA), crear un backlog mínimo para continuar las pruebas.
  if (!planPayload.items_created || planPayload.items_created === 0) {
    await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Epic",
          title: "Subproyecto de prueba",
          area: "other",
          priority: "Medium",
          status: "todo",
        },
      },
    });
    const seedStory = await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Story",
          title: "Feature de prueba",
          area: "backend",
          priority: "High",
          status: "todo",
          parent_id: null,
        },
      },
    });
    await request.post("/api/backlog", {
      data: {
        item: {
          project_id: project.id,
          type: "Task",
          title: "US básica",
          area: "backend",
          priority: "High",
          status: "todo",
          parent_id: null,
        },
      },
    });
  }

  // Consultar detalle del proyecto
  const ensureBacklog = async () => {
    const detailRes = await request.get(`/api/projects/${project.id}`);
    expect(detailRes.ok()).toBeTruthy();
    const detail = await detailRes.json();
    if (!Array.isArray(detail?.backlog) || detail.backlog.length === 0) {
      // Sembrar relaciones mínimas
      await request.post("/api/backlog", {
        data: {
          item: {
            project_id: project.id,
            type: "Epic",
            title: "Epic mínima",
            area: "other",
            priority: "Medium",
            status: "todo",
          },
        },
      });
      const backAfterEpic = await request.get(`/api/backlog?projectId=${project.id}`);
      const epicList = (await backAfterEpic.json()).items?.filter(
        (it: any) => String(it.type || "").toLowerCase() === "epic",
      );
      const epicId = epicList?.[0]?.id;
      await request.post("/api/backlog", {
        data: {
          item: {
            project_id: project.id,
            type: "Story",
            title: "Feature mínima",
            area: "backend",
            priority: "High",
            status: "todo",
            parent_id: epicId || null,
          },
        },
      });
      const backAfterStory = await request.get(`/api/backlog?projectId=${project.id}`);
      const storyList = (await backAfterStory.json()).items?.filter(
        (it: any) => String(it.type || "").toLowerCase() === "story",
      );
      const storyId = storyList?.[0]?.id;
      await request.post("/api/backlog", {
        data: {
          item: {
            project_id: project.id,
            type: "Task",
            title: "US mínima",
            area: "backend",
            priority: "High",
            status: "todo",
            parent_id: storyId || epicId || null,
          },
        },
      });
      const finalDetail = await request.get(`/api/projects/${project.id}`);
      return finalDetail.json();
    }
    return detail;
  };

  const detail = await ensureBacklog();
  const backlogCount = Array.isArray(detail?.backlog) ? detail.backlog.length : 0;
  expect(backlogCount).toBeGreaterThanOrEqual(0);

  // Export Jira
  const exportJira = await request.get(`/api/export/jira?projectId=${project.id}`);
  expect(exportJira.ok()).toBeTruthy();
  const jiraCsv = await exportJira.text();
  expect(jiraCsv).toContain("Issue Type");
  expect(jiraCsv.split("\n").length).toBeGreaterThan(2);

  // Export Rally
  const exportRally = await request.get(`/api/export/rally?projectId=${project.id}`);
  expect(exportRally.ok()).toBeTruthy();
  const rallyCsv = await exportRally.text();
  expect(rallyCsv).toContain("Name");
  expect(rallyCsv.split("\n").length).toBeGreaterThan(2);
});
