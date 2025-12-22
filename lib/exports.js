function escapeCsv(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function buildJiraCsv(items) {
  const header = [
    "Issue Type",
    "Summary",
    "Description",
    "Epic Name",
    "Epic Link",
    "Priority",
    "Story Points",
    "Labels",
    "Components",
    "Acceptance Criteria",
    "External ID",
  ];

  const rows = items.map((item) => {
    const issueType = item.type || "Task";
    const description = [item.description, item.source_snippet ? `\nFuente: ${item.source_snippet}` : ""]
      .filter(Boolean)
      .join("\n");
    const labels = Array.isArray(item.labels) ? item.labels.join(" ") : "";
    const acceptance = Array.isArray(item.acceptance_criteria)
      ? item.acceptance_criteria.join(" | ")
      : "";
    const epicName = issueType === "Epic" ? item.title : "";
    const epicLink = issueType !== "Epic" ? item.epic_key || item.parent_external_id || "" : "";

    return [
      issueType,
      item.title,
      description,
      epicName,
      epicLink,
      item.priority || "Medium",
      item.story_points ?? "",
      labels,
      item.area || "",
      acceptance,
      item.external_id,
    ];
  });

  return toCsv([header, ...rows]);
}

export function buildRallyCsv(items) {
  const header = [
    "FormattedID",
    "Name",
    "Description",
    "WorkProduct",
    "ScheduleState",
    "Iteration",
    "Tags",
    "Owner",
    "Estimate",
    "Priority",
    "External ID",
  ];

  const rows = items.map((item) => {
    const tags = Array.isArray(item.labels) ? item.labels.join(" ") : "";
    return [
      "",
      item.title,
      item.description || "",
      item.parent_external_id || item.epic_key || "",
      item.status || "Defined",
      "",
      tags,
      "",
      item.estimate_hours ?? "",
      item.priority || "Medium",
      item.external_id,
    ];
  });

  return toCsv([header, ...rows]);
}
