import { describe, expect, it } from "vitest";
import { buildJiraCsv, buildRallyCsv } from "../lib/exports.js";

describe("CSV exports", () => {
  it("buildJiraCsv maps epic link for stories", () => {
    const items = [
      {
        external_id: "T-001",
        type: "Epic",
        title: "Epic Auth",
        description: "Epic desc",
        priority: "High",
        story_points: 8,
        labels: ["auth"],
        area: "backend",
        acceptance_criteria: ["Ok"],
      },
      {
        external_id: "T-002",
        type: "Story",
        title: "Login UI",
        description: "Story desc",
        priority: "Medium",
        story_points: 3,
        labels: ["ui"],
        area: "frontend",
        acceptance_criteria: ["Done"],
        parent_external_id: "T-001",
      },
    ];

    const csv = buildJiraCsv(items);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Issue Type");
    const storyLine = lines.find((line) => line.includes("Login UI"));
    expect(storyLine).toBeTruthy();
    expect(storyLine.split(",")[4]).toBe("T-001");
  });

  it("buildRallyCsv uses parent_external_id as WorkProduct", () => {
    const items = [
      {
        external_id: "T-010",
        type: "Epic",
        title: "Payments",
        description: "Epic desc",
        priority: "High",
      },
      {
        external_id: "T-011",
        type: "Story",
        title: "Payments feature",
        description: "Story desc",
        priority: "Medium",
        parent_external_id: "T-010",
      },
      {
        external_id: "T-012",
        type: "Task",
        title: "US: Invoice flow",
        description: "Task desc",
        priority: "Low",
        parent_external_id: "T-011",
      },
    ];

    const csv = buildRallyCsv(items);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("WorkProduct");
    const taskLine = lines.find((line) => line.includes("US: Invoice flow"));
    expect(taskLine).toBeTruthy();
    expect(taskLine.split(",")[3]).toBe("T-011");
  });
});
