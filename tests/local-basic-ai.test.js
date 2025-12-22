import { describe, expect, it } from "vitest";
import { buildLocalAsk, buildLocalPlan } from "../lib/local-basic-ai.js";

describe("local basic AI", () => {
  it("buildLocalPlan creates epics and links children", () => {
    const chunks = [
      {
        chunk_id: "CH-01",
        title: "Auth",
        content: "- Login con MFA\n- Recuperar password",
      },
    ];

    const result = buildLocalPlan(chunks, "");
    const epics = result.items.filter((item) => item.type === "Epic");
    const stories = result.items.filter((item) => item.type === "Story");
    const tasks = result.items.filter((item) => item.type === "Task");

    expect(epics.length).toBeGreaterThan(0);
    expect(stories.length).toBeGreaterThan(0);
    expect(tasks.length).toBeGreaterThan(0);
    const epicId = epics[0].external_id;
    const allStoriesLinked = stories.every((item) => item.parent_external_id === epicId);
    expect(allStoriesLinked).toBe(true);

    const storyIds = new Set(stories.map((story) => story.external_id));
    const allTasksLinked = tasks.every((task) => storyIds.has(task.parent_external_id));
    expect(allTasksLinked).toBe(true);
  });

  it("buildLocalAsk returns citations when answer exists", () => {
    const chunks = [
      {
        chunk_id: "CH-09",
        title: "Pagos",
        content: "Se definen pagos semanales y validacion manual.",
      },
    ];

    const response = buildLocalAsk("Como se gestionan los pagos?", chunks);
    expect(response.if_not_found).toBe(false);
    expect(response.citations.length).toBeGreaterThan(0);
  });
});
