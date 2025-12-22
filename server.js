const path = require("path");
const express = require("express");
const { analyze } = require("./analysis");

const app = express();
const port = process.env.PORT || 5173;
const AI_AREAS = ["scope", "schedule", "cost", "risk", "compliance", "testing", "general"];
const AI_SEVERITIES = ["high", "medium", "low"];

app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ai: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/analyze", async (req, res) => {
  const { baseline, revised, lang } = req.body || {};
  if (typeof baseline !== "string" || typeof revised !== "string") {
    res.status(400).json({ error: "Baseline and revised text are required." });
    return;
  }
  const result = analyze(baseline, revised, { lang });
  let changes = result.changes;
  if (process.env.OPENAI_API_KEY) {
    try {
      changes = await enrichChangesWithAI(changes, lang);
    } catch (error) {
      console.warn("AI enrichment failed, using heuristic output.", error.message);
    }
  }
  res.json({ changes, ai: Boolean(process.env.OPENAI_API_KEY) });
});

app.use(express.static(path.join(__dirname)));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`DeltaScope AI running on http://localhost:${port}`);
});

async function enrichChangesWithAI(changes, lang = "es") {
  if (!Array.isArray(changes) || changes.length === 0) {
    return changes;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return changes;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.OPENAI_ORG) {
    headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
  }
  if (process.env.OPENAI_PROJECT) {
    headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
  }

  const payloadChanges = changes.map((change) => ({
    id: change.id,
    section: change.section,
    changeType: change.changeType,
    oldText: truncateText(change.oldText, 700),
    newText: truncateText(change.newText, 700),
  }));

  const systemMessage = [
    "You are an expert PMO change analyst.",
    "Classify document changes and return JSON only.",
    "Use allowed areas: scope, schedule, cost, risk, compliance, testing, general.",
    "Use severity: high, medium, low.",
  ].join(" ");

  const userMessage = [
    `Language: ${lang === "en" ? "en" : "es"}.`,
    "For each change id, provide:",
    "- summary (1-2 sentences),",
    "- areas (array of allowed values),",
    "- severity (high|medium|low),",
    "- reasons (1-3 items),",
    "- actions (2-5 items).",
    "Return JSON with shape:",
    '{\"changes\":[{\"id\":\"...\",\"summary\":\"...\",\"areas\":[...],\"severity\":\"...\",\"reasons\":[...],\"actions\":[...]}]}',
    "Only use provided ids. Do not add extra keys.",
    `Changes:\n${JSON.stringify(payloadChanges, null, 2)}`,
  ].join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("OpenAI response was not valid JSON.");
  }

  return mergeChangesWithAI(changes, parsed?.changes);
}

function mergeChangesWithAI(changes, aiChanges) {
  if (!Array.isArray(aiChanges)) {
    return changes;
  }
  const aiMap = new Map(
    aiChanges
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );

  return changes.map((change) => {
    const ai = aiMap.get(change.id);
    if (!ai) {
      return change;
    }
    return {
      ...change,
      summary: normalizeText(ai.summary, change.summary),
      areas: normalizeAreas(ai.areas, change.areas),
      severity: normalizeSeverity(ai.severity, change.severity),
      reasons: normalizeList(ai.reasons, change.reasons),
      actions: normalizeList(ai.actions, change.actions),
    };
  });
}

function truncateText(text, limit) {
  if (typeof text !== "string") {
    return "";
  }
  const cleaned = text.trim();
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, limit)}…`;
}

function normalizeText(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function normalizeAreas(value, fallback) {
  const areas = Array.isArray(value) ? value.filter((item) => AI_AREAS.includes(item)) : [];
  return areas.length > 0 ? areas : fallback;
}

function normalizeSeverity(value, fallback) {
  return AI_SEVERITIES.includes(value) ? value : fallback;
}

function normalizeList(value, fallback) {
  const list = Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  return list.length > 0 ? list.slice(0, 6) : fallback;
}
