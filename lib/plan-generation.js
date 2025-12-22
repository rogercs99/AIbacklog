import { callAI } from "@/lib/ai";
import { chunkText } from "@/lib/chunking";
import { buildLocalPlan } from "@/lib/local-basic-ai";
import {
  getDb,
  getDefaultProject,
  getLatestDocument,
  getProjectById,
  insertChange,
  insertChunks,
  insertDocument,
  listBacklogItems,
} from "@/lib/db";

function snippet(text, limit = 140) {
  if (!text) {
    return "";
  }
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}...`;
}

function buildProjectContext({ project, latestDocument, backlogItems }) {
  const parts = [];
  if (project?.name) {
    parts.push(`Proyecto: ${project.name}`);
  }
  if (project?.description) {
    let descriptionText = "";
    try {
      const parsed = JSON.parse(project.description);
      descriptionText = parsed?.description_es || parsed?.description_en || "";
    } catch (error) {
      descriptionText = String(project.description || "");
    }
    if (descriptionText) {
      parts.push(`Descripción actual del proyecto: ${snippet(descriptionText, 420)}`);
    }
  }
  if (latestDocument?.text) {
    parts.push(
      `Documento anterior (${latestDocument.version || "previo"}): ${snippet(
        latestDocument.text,
        520,
      )}`,
    );
  }
  if (Array.isArray(backlogItems) && backlogItems.length > 0) {
    const lines = backlogItems.slice(0, 12).map((item) => {
      const area = item.area || "other";
      const type = item.type || "Story";
      const title = item.title ? snippet(item.title, 90) : "Sin titulo";
      const status = item.status || "todo";
      const blocked = item.blocked_reason ? " BLOQUEADA" : "";
      return `- ${item.external_id || ""} [${type}] ${title} (${area}) status=${status}${blocked}`;
    });
    parts.push(`Backlog existente:\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

function normalizeType(value) {
  const raw = String(value || "").toLowerCase();
  const trimmed = raw.trim();
  if (
    trimmed === "us" ||
    trimmed === "u.s" ||
    raw.includes("user story") ||
    raw.includes("userstory") ||
    raw.includes("historia de usuario")
  ) {
    return "Task";
  }
  if (
    raw.includes("initiative") ||
    raw.includes("iniciativa") ||
    raw.includes("subproyecto") ||
    raw.includes("epic") ||
    raw.includes("epica") ||
    raw.includes("épica")
  ) {
    return "Epic";
  }
  if (raw.includes("feature") || raw.includes("funcionalidad")) {
    return "Story";
  }
  if (raw.includes("task") || raw.includes("tarea") || raw.includes("subtask") || raw.includes("subtarea")) {
    return "Task";
  }
  if (raw.includes("story") || raw.includes("historia")) {
    return "Story";
  }
  return "Story";
}

function ensureEpicLinks(rawItems, chunks, project = null) {
  const items = (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
    ...item,
    type: normalizeType(item.type),
  }));
  if (items.length === 0) {
    return items;
  }

  const genericTitles = ["subproyecto general", "general", "default", "sin subproyecto", "misc"];
  const isGenericTitle = (value = "") => {
    const val = String(value || "").trim().toLowerCase();
    return genericTitles.includes(val);
  };

  const existingIds = new Set();
  items.forEach((item) => {
    if (item.external_id) {
      existingIds.add(item.external_id);
    }
  });

  let counter = 1;
  const nextId = () => {
    let id = "";
    do {
      id = `T-${String(counter++).padStart(3, "0")}`;
    } while (existingIds.has(id));
    return id;
  };

  items.forEach((item) => {
    if (!item.external_id) {
      const id = nextId();
      item.external_id = id;
      existingIds.add(id);
    }
  });

  let epics = items.filter((item) => item.type === "Epic");
  if (epics.length === 0) {
    const firstChunk = chunks?.[0];
    const epicExternalId = nextId();
    const epicItem = {
      external_id: epicExternalId,
      type: "Epic",
      parent_external_id: null,
      title: firstChunk?.title
        ? `Subproyecto: ${firstChunk.title}`
        : project?.name
          ? `Subproyecto: ${project.name}`
          : "Subproyecto contextual",
      description: firstChunk
        ? `Contexto: ${snippet(firstChunk.content, 180)}`
        : project?.name
          ? `Alineado con ${project.name}`
          : "Agrupa tareas sin subproyecto especifico.",
      area: "other",
      priority: "Medium",
      source_chunk_id: firstChunk?.chunk_id || null,
      source_snippet: firstChunk ? snippet(firstChunk.content, 140) : "",
    };
    items.unshift(epicItem);
    epics = [epicItem];
    existingIds.add(epicExternalId);
  }

  const epicBySource = new Map();
  epics.forEach((epic) => {
    if (epic.source_chunk_id) {
      epicBySource.set(epic.source_chunk_id, epic.external_id);
    }
  });
  const defaultEpicId = epics[0]?.external_id || null;

  const safeChunkFor = (item) => {
    if (!chunks?.length) {
      return null;
    }
    if (item?.source_chunk_id) {
      return chunks.find((chunk) => chunk.chunk_id === item.source_chunk_id) || chunks[0];
    }
    return chunks[0];
  };

  // Normalizaciones base y trazabilidad mínima.
  items.forEach((item) => {
    if (item.type === "Epic") {
      item.parent_external_id = null;
    }
    const area = String(item.area || "other");
    item.area = area.split(/[|,]/)[0]?.trim() || "other";
    item.priority = item.priority || "Medium";
    item.description = item.description || item.title || "";
    if (!Array.isArray(item.clarification_questions)) {
      item.clarification_questions = [];
    }
    if (item.type !== "Epic" && item.clarification_questions.length === 0) {
      item.clarification_questions =
        item.type === "Story"
          ? [
              "¿Cuál es el flujo exacto (pasos) que debe soportar?",
              "¿Qué criterio de aceptación usaréis para darlo por hecho?",
              "¿Qué casos borde/errores deben contemplarse?",
            ]
          : [
              "¿Qué datos exactos entran/salen en este caso?",
              "¿Qué casos borde/errores debemos contemplar?",
              "¿Qué parte depende del cliente (inputs, accesos, decisiones)?",
            ];
    }
    if (!Array.isArray(item.acceptance_criteria)) {
      item.acceptance_criteria = [];
    }
    if (!Array.isArray(item.dependencies)) {
      item.dependencies = [];
    }
    if (!Array.isArray(item.labels)) {
      item.labels = [];
    }
    if (!Array.isArray(item.risks)) {
      item.risks = [];
    }
    if (!item.source_chunk_id && chunks?.[0]?.chunk_id) {
      item.source_chunk_id = chunks[0].chunk_id;
    }
    if (!item.source_snippet) {
      const sourceChunk = safeChunkFor(item);
      item.source_snippet = snippet(sourceChunk?.content || "", 140);
    }
    if (item.type === "Epic") {
      const chunkRef = safeChunkFor(item);
      if (isGenericTitle(item.title)) {
        const contextTitle =
          chunkRef?.title ||
          snippet(chunkRef?.content || "", 60) ||
          project?.name ||
          "Subproyecto";
        item.title = `Subproyecto: ${contextTitle}`;
      }
      if (!item.description || item.description.trim().length < 24) {
        item.description =
          chunkRef?.content && snippet(chunkRef.content, 200)
            ? `Contexto: ${snippet(chunkRef.content, 200)}`
            : `Contexto del proyecto: ${project?.name || "no definido"}`;
      }
    }
  });

  const epicByExternalId = new Map(epics.map((epic) => [epic.external_id, epic]));
  const stories = items.filter((item) => item.type === "Story");
  const tasks = items.filter((item) => item.type === "Task");
  const storyByExternalId = new Map(stories.map((story) => [story.external_id, story]));

  const ensureStory = ({ epicExternalId, sourceItem }) => {
    const chunk = safeChunkFor(sourceItem) || safeChunkFor({ source_chunk_id: epicByExternalId.get(epicExternalId)?.source_chunk_id });
    const titleBase = epicByExternalId.get(epicExternalId)?.title || "Feature";
    const storyExternalId = nextId();
    const story = {
      external_id: storyExternalId,
      type: "Story",
      parent_external_id: epicExternalId,
      title: `Feature: ${titleBase}`.slice(0, 120),
      description: chunk ? snippet(chunk.content, 220) : `Feature asociada a ${titleBase}.`,
      area: sourceItem?.area || "other",
      priority: sourceItem?.priority || "Medium",
      story_points: 5,
      estimate_hours: 8,
      acceptance_criteria: [],
      dependencies: [],
      labels: [],
      risks: [],
      clarification_questions: [
        "¿Cuál es el flujo exacto (pasos) que debe soportar?",
        "¿Qué criterios de aceptación usaréis para validar la feature?",
      ],
      source_chunk_id: sourceItem?.source_chunk_id || chunk?.chunk_id || null,
      source_snippet: snippet(sourceItem?.source_snippet || chunk?.content || "", 140),
    };
    items.push(story);
    stories.push(story);
    storyByExternalId.set(storyExternalId, story);
    existingIds.add(storyExternalId);
    return story;
  };

  const ensureTask = ({ storyExternalId, sourceItem }) => {
    const chunk = safeChunkFor(sourceItem);
    const taskExternalId = nextId();
    const task = {
      external_id: taskExternalId,
      type: "Task",
      parent_external_id: storyExternalId,
      title: `US: ${sourceItem?.title || storyByExternalId.get(storyExternalId)?.title || "Trabajo"}`.slice(0, 140),
      description:
        sourceItem?.description ||
        `Como usuario, quiero completar \"${sourceItem?.title || storyByExternalId.get(storyExternalId)?.title || "esta funcionalidad"}\" para obtener un resultado verificable.`,
      area: sourceItem?.area || storyByExternalId.get(storyExternalId)?.area || "other",
      priority: sourceItem?.priority || "Medium",
      story_points: sourceItem?.story_points ?? 2,
      estimate_hours: sourceItem?.estimate_hours ?? 4,
      acceptance_criteria: Array.isArray(sourceItem?.acceptance_criteria) ? sourceItem.acceptance_criteria : [],
      dependencies: Array.isArray(sourceItem?.dependencies) ? sourceItem.dependencies : [],
      labels: Array.isArray(sourceItem?.labels) ? sourceItem.labels : [],
      risks: Array.isArray(sourceItem?.risks) ? sourceItem.risks : [],
      clarification_questions: Array.isArray(sourceItem?.clarification_questions)
        ? sourceItem.clarification_questions
        : [
            "¿Qué datos exactos entran/salen en este caso?",
            "¿Qué errores o casos borde debemos contemplar?",
          ],
      source_chunk_id: sourceItem?.source_chunk_id || chunk?.chunk_id || null,
      source_snippet: snippet(sourceItem?.source_snippet || chunk?.content || "", 140),
    };
    items.push(task);
    tasks.push(task);
    existingIds.add(taskExternalId);
    return task;
  };

  // 1) Las Stories (Features) deben colgar de Epic (Iniciativa/Subproyecto).
  stories.forEach((story) => {
    if (story.parent_external_id && !epicByExternalId.has(story.parent_external_id)) {
      story.parent_external_id = null;
    }
    if (!story.parent_external_id) {
      const fromSource = story.source_chunk_id ? epicBySource.get(story.source_chunk_id) : null;
      story.parent_external_id = fromSource || defaultEpicId || null;
    }
  });

  // 2) Cada Epic debe tener al menos 1 Story.
  const storiesByEpic = new Map();
  stories.forEach((story) => {
    const epicExternalId = story.parent_external_id || defaultEpicId || "unassigned";
    if (!storiesByEpic.has(epicExternalId)) {
      storiesByEpic.set(epicExternalId, []);
    }
    storiesByEpic.get(epicExternalId).push(story);
  });
  epics.forEach((epic) => {
    const currentStories = storiesByEpic.get(epic.external_id) || [];
    while (currentStories.length < 2) {
      const created = ensureStory({ epicExternalId: epic.external_id, sourceItem: epic });
      currentStories.push(created);
    }
    storiesByEpic.set(epic.external_id, currentStories);
  });

  // 3) Las Tasks (User Stories) deben colgar de una Story (Feature).
  const tasksByStory = new Map();
  tasks.forEach((task) => {
    let storyExternalId = null;
    if (task.parent_external_id && storyByExternalId.has(task.parent_external_id)) {
      storyExternalId = task.parent_external_id;
    } else if (task.parent_external_id && epicByExternalId.has(task.parent_external_id)) {
      const epicExternalId = task.parent_external_id;
      const list = storiesByEpic.get(epicExternalId) || [];
      storyExternalId = list[0]?.external_id || ensureStory({ epicExternalId, sourceItem: task }).external_id;
    } else {
      const epicExternalId = task.source_chunk_id ? epicBySource.get(task.source_chunk_id) : null;
      const resolvedEpic = epicExternalId || defaultEpicId || epics[0]?.external_id;
      const list = storiesByEpic.get(resolvedEpic) || [];
      storyExternalId = list[0]?.external_id || ensureStory({ epicExternalId: resolvedEpic, sourceItem: task }).external_id;
    }
    task.parent_external_id = storyExternalId;
    if (!tasksByStory.has(storyExternalId)) {
      tasksByStory.set(storyExternalId, []);
    }
    tasksByStory.get(storyExternalId).push(task);
  });

  // 4) Cada Story debe tener al menos 1 Task (US) para que la jerarquía sea navegable.
  stories.forEach((story) => {
    const list = tasksByStory.get(story.external_id) || [];
    const minTasks = 3;
    while (list.length < minTasks) {
      const created = ensureTask({
        storyExternalId: story.external_id,
        sourceItem: story,
      });
      list.push(created);
    }
    tasksByStory.set(story.external_id, list);
  });

  return items;
}

function deduplicateItems(items) {
  const seen = new Set();
  const usedTitles = new Map(); // type -> Set of titles
  const results = [];

  items.forEach((item) => {
    const parentKey = item.parent_external_id || "root";
    const sourceKey = item.source_chunk_id || "";
    let titleKey = String(item.title || "").trim();
    if (!usedTitles.has(item.type)) {
      usedTitles.set(item.type, new Set());
    }
    const titleSet = usedTitles.get(item.type);

    // Evitar títulos duplicados dentro del mismo tipo
    let suffix = 1;
    let baseTitle = titleKey;
    while (titleSet.has(titleKey.toLowerCase())) {
      suffix += 1;
      titleKey = `${baseTitle} (${suffix})`;
    }
    titleSet.add(titleKey.toLowerCase());
    item.title = titleKey;

    const key = `${item.type}|${parentKey}|${titleKey.toLowerCase()}|${sourceKey}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(item);
  });

  return results;
}

export async function generatePlan({ text, version = "v1", projectId, context = "" }) {
  const cleanedText = String(text || "").trim();
  if (!cleanedText) {
    const error = new Error("Documento vacío.");
    error.status = 400;
    throw error;
  }

  const numericProjectId = Number(projectId);
  let project = null;
  if (numericProjectId) {
    project = getProjectById(numericProjectId);
  }
  if (!project) {
    project = getDefaultProject();
  }

  const existingDocument = getLatestDocument(project.id);
  const existingBacklog = listBacklogItems(project.id);
  const db = getDb();
  const memoryRow = db
    .prepare("SELECT memory FROM project_memory WHERE project_id = ? LIMIT 1")
    .get(project.id);
  const projectMemory = String(memoryRow?.memory || "").trim();
  const projectContext = buildProjectContext({
    project,
    latestDocument: existingDocument,
    backlogItems: existingBacklog,
  });
  const combinedContext = [
    String(context || "").trim(),
    projectMemory ? `MEMORIA DEL PROYECTO (persistente):\n${projectMemory}` : "",
    projectContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  const documentId = insertDocument(project.id, version, cleanedText);
  const chunks = chunkText(cleanedText).map((chunk) => ({
    ...chunk,
    document_id: documentId,
  }));
  insertChunks(
    documentId,
    chunks.map((chunk) => ({
      chunk_index: chunk.chunk_index,
      title: chunk.title,
      content: chunk.content,
    })),
  );

  const system =
    "Eres un analista funcional y tech lead. Convierte requerimientos en backlog ejecutable.";
  const contextBlock = combinedContext
    ? `\n\nCONTEXTO ADICIONAL:\n${combinedContext}`
    : "";
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase().trim();
  const usingGemini = provider === "gemini";

  // Si se configuran límites muy bajos, algunos modelos (sobre todo Gemini)
  // tienden a devolver JSON truncado/ inválido. Forzamos mínimos razonables
  // para que la demo sea estable.
  const minItems = usingGemini ? 8 : 5;
  const requestedMaxItems =
    Number.isFinite(Number(process.env.AI_PLAN_MAX_ITEMS)) &&
    Number(process.env.AI_PLAN_MAX_ITEMS) > 0
      ? Number(process.env.AI_PLAN_MAX_ITEMS)
      : 10;
  const maxItems = Math.max(requestedMaxItems, minItems);

  const minPlanTokens = usingGemini ? 900 : 600;
  const requestedPlanTokens =
    Number.isFinite(Number(process.env.AI_PLAN_MAX_TOKENS)) &&
    Number(process.env.AI_PLAN_MAX_TOKENS) > 0
      ? Number(process.env.AI_PLAN_MAX_TOKENS)
      : undefined;
  const planMaxTokens =
    requestedPlanTokens && requestedPlanTokens >= minPlanTokens
      ? requestedPlanTokens
      : minPlanTokens;

  const buildPromptForChunks = (chunkPayload) =>
    `REGLAS:\n- NO inventes informacion no presente. Si falta, anadelo a missing_info con prioridad y motivo.\n- Jerarquia obligatoria (para que se vea como Rally/Jira):\n  - Epic = Iniciativa/Subproyecto (nivel superior)\n  - Story = Feature (2-4 por Epic)\n  - Task = User Story (US) (3-6 por Feature)\n  - Cada Task (US) DEBE colgar de una Story (Feature) via parent_external_id.\n  - Las Task (US) NO deben colgar directamente de un Epic.\n- Para software: cubre frontend, backend, api, db, qa, devops, security cuando aplique (repartido en las US).\n- Cada backlog item debe incluir trazabilidad: source_chunk_id y source_snippet.\n- Limita los items a un maximo de ${maxItems} por respuesta. Prioriza lo esencial.\n- summary debe ser Markdown (tono corporativo y claro) y NO debe mencionar modelos, prompts o IA.\n  - 1-2 párrafos: qué se ha entendido del documento.\n  - Lista (3-6) de alcance/entregables.\n  - Lista (3-6) de riesgos o puntos pendientes.\n- En description usa Markdown con tono apto para publico no tecnico:\n  - 2-4 frases en lenguaje sencillo explicando que es y por que importa.\n  - Seccion \"Que haremos\" con 3-6 bullets accionables.\n  - Seccion \"Que validar\" con 2-4 bullets.\n- clarification_questions es obligatorio en Story y Task (2-4 preguntas concretas para preguntar al cliente).\n- Devuelve SOLO JSON valido, sin texto extra.\n\nOUTPUT JSON:\n{\n  \"summary\": \"...\",\n  \"assumptions\": [\"...\"],\n  \"missing_info\": [{\"question\":\"...\", \"priority\":\"High|Medium|Low\", \"reason\":\"...\"}],\n  \"items\": [\n    {\n      \"external_id\":\"T-001\",\n      \"type\":\"Epic|Story|Task\",\n      \"parent_external_id\":\"T-000|null\",\n      \"title\":\"...\",\n      \"description\":\"...\",\n      \"area\":\"frontend|backend|api|db|qa|devops|security|other\",\n      \"priority\":\"High|Medium|Low\",\n      \"story_points\": 0,\n      \"estimate_hours\": 0,\n      \"acceptance_criteria\":[\"...\"],\n      \"dependencies\":[\"T-123\"],\n      \"labels\":[\"...\"],\n      \"risks\":[{\"risk\":\"...\",\"impact\":\"...\",\"mitigation\":\"...\"}],\n      \"clarification_questions\":[\"...\"] ,\n      \"source_chunk_id\":\"CH-03\",\n      \"source_snippet\":\"...\"\n    }\n  ]\n}\n${contextBlock}\n\nCHUNKS:\n${JSON.stringify(chunkPayload, null, 2)}`;

  const buildCompactPrompt = (chunkPayload) =>
    `REGLAS:\n- NO inventes informacion no presente. Si falta, anadelo a missing_info con prioridad y motivo.\n- Limita los items a un maximo de ${maxItems} por respuesta.\n- Jerarquia: 1 Epic (iniciativa), 2-3 Stories (features) y 3-6 Tasks (US) por feature si el contenido lo permite.\n- Cada Task (US) DEBE colgar de una Story (Feature) via parent_external_id.\n- clarification_questions es obligatorio (2-4) en Story y Task.\n- summary debe ser Markdown breve (1 párrafo + 3 bullets) y NO debe mencionar modelos ni IA.\n- En description usa Markdown: 2-4 frases en lenguaje sencillo + seccion \"Que haremos\" con bullets.\n- Devuelve SOLO JSON valido, sin texto extra.\n\nOUTPUT JSON:\n{\n  \"summary\": \"...\",\n  \"missing_info\": [{\"question\":\"...\", \"priority\":\"High|Medium|Low\", \"reason\":\"...\"}],\n  \"items\": [\n    {\n      \"external_id\":\"T-001\",\n      \"type\":\"Epic|Story|Task\",\n      \"parent_external_id\":\"T-000|null\",\n      \"title\":\"...\",\n      \"description\":\"...\",\n      \"area\":\"frontend|backend|api|db|qa|devops|security|other\",\n      \"priority\":\"High|Medium|Low\",\n      \"clarification_questions\":[\"...\"]\n    }\n  ]\n}\n${contextBlock}\n\nCHUNKS:\n${JSON.stringify(chunkPayload, null, 2)}`;

  const buildTinyPrompt = (chunkPayload) =>
    `REGLAS:\n- NO inventes informacion no presente.\n- Devuelve SOLO JSON valido, sin texto extra.\n- Devuelve exactamente 3 items: 1 Epic, 1 Story (Feature) y 1 Task (US).\n- La Task (US) debe colgar de la Story via parent_external_id.\n- summary debe ser Markdown breve y NO debe mencionar modelos ni IA.\n- En description usa Markdown: 2-4 frases en lenguaje sencillo + bullets accionables.\n\nOUTPUT JSON:\n{\n  \"summary\": \"...\",\n  \"items\": [\n    {\n      \"external_id\":\"T-001\",\n      \"type\":\"Epic|Story|Task\",\n      \"parent_external_id\":\"T-000|null\",\n      \"title\":\"...\",\n      \"description\":\"...\",\n      \"area\":\"frontend|backend|api|db|qa|devops|security|other\",\n      \"priority\":\"High|Medium|Low\",\n      \"clarification_questions\":[\"...\"]\n    }\n  ]\n}\n${contextBlock}\n\nCHUNKS:\n${JSON.stringify(chunkPayload, null, 2)}`;

  let aiResult;
  if (process.env.LOCAL_AI_MODE === "basic") {
    aiResult = buildLocalPlan(chunks, combinedContext);
  } else {
    const chunkedEnv = String(process.env.AI_PLAN_CHUNKED || "").toLowerCase().trim();
    const chunkedRequested = ["1", "true", "yes", "on"].includes(chunkedEnv);
    const chunkedDisabled = ["0", "false", "no", "off"].includes(chunkedEnv);
    const preferChunked = usingGemini || Boolean(process.env.LOCAL_AI_URL);
    const useChunkedPlan = chunkedRequested || (!chunkedDisabled && preferChunked);

    if (useChunkedPlan) {
      const merged = {
        summary: "",
        assumptions: [],
        missing_info: [],
        items: [],
      };
      let counter = 1;
      for (const chunk of chunks) {
        const chunkPrompt = buildCompactPrompt([
          {
            chunk_id: chunk.chunk_id,
            title: chunk.title,
            content: chunk.content,
          },
        ]);
        try {
          let chunkResult;
          try {
            chunkResult = await callAI({
              system,
              user: chunkPrompt,
              maxTokens: planMaxTokens,
            });
          } catch (error) {
            const tinyPrompt = buildTinyPrompt([
              {
                chunk_id: chunk.chunk_id,
                title: chunk.title,
                content: chunk.content,
              },
            ]);
            try {
              chunkResult = await callAI({
                system,
                user: tinyPrompt,
                maxTokens: Math.max(planMaxTokens || 300, 400),
              });
            } catch (fallbackError) {
              chunkResult = buildLocalPlan([chunk], combinedContext);
            }
          }
          const items = Array.isArray(chunkResult?.items) ? chunkResult.items : [];
          items.forEach((item) => {
            item.type = normalizeType(item.type);
            if (!item.external_id) {
              item.external_id = `TMP-${chunk.chunk_id}-${Math.random().toString(36).slice(2, 6)}`;
            }
          });

          let epicItem = items.find((item) => item.type === "Epic");
          if (!epicItem) {
            epicItem = {
              external_id: `TMP-EPIC-${chunk.chunk_id}`,
              type: "Epic",
              parent_external_id: null,
              title: `Epic: ${chunk.title || "Requisitos"}`,
              area: "other",
              priority: "Medium",
              description: snippet(chunk.content, 160),
              source_chunk_id: chunk.chunk_id,
              source_snippet: snippet(chunk.content, 140),
            };
            items.unshift(epicItem);
          }

          const epicOriginalId = epicItem.external_id;
          const idMap = new Map();
          items.forEach((item) => {
            const nextId = `T-${String(counter++).padStart(3, "0")}`;
            idMap.set(item.external_id, nextId);
            item.external_id = nextId;
          });
          const epicExternalId = idMap.get(epicOriginalId);
          items.forEach((item) => {
            if (item.parent_external_id) {
              item.parent_external_id = idMap.get(item.parent_external_id) || null;
            }
            if (item.type !== "Epic" && !item.parent_external_id && epicExternalId) {
              item.parent_external_id = epicExternalId;
            }
            const area = String(item.area || "other");
            item.area = area.split(/[|,]/)[0]?.trim() || "other";
            item.priority = item.priority || "Medium";
            item.description = item.description || item.title;
            item.source_chunk_id = item.source_chunk_id || chunk.chunk_id;
            item.source_snippet = item.source_snippet || snippet(chunk.content, 140);
          });
          merged.items.push(...items);
          if (!merged.summary && chunkResult?.summary) {
            merged.summary = chunkResult.summary;
          }
          merged.assumptions.push(...(chunkResult?.assumptions || []));
          merged.missing_info.push(...(chunkResult?.missing_info || []));
        } catch (error) {
          const fatal = new Error(error.message || "No se pudo llamar al modelo.");
          fatal.status = 500;
          throw fatal;
        }
      }
      merged.assumptions = Array.from(new Set(merged.assumptions));
      aiResult = merged;
    } else {
      const user = buildPromptForChunks(
        chunks.map((chunk) => ({
          chunk_id: chunk.chunk_id,
          title: chunk.title,
          content: chunk.content,
        })),
      );
      try {
        aiResult = await callAI({ system, user, maxTokens: planMaxTokens });
      } catch (error) {
        const fatal = new Error(error.message || "No se pudo llamar al modelo.");
        fatal.status = 500;
        throw fatal;
      }
    }
  }

  const items = deduplicateItems(ensureEpicLinks(aiResult?.items, chunks, project));
  const itemByExternalId = new Map(items.map((item) => [item.external_id, item]));
  const rootEpicCache = new Map();

  const getRootEpicExternalId = (externalId, trail = new Set()) => {
    if (!externalId) {
      return null;
    }
    if (rootEpicCache.has(externalId)) {
      return rootEpicCache.get(externalId);
    }
    if (trail.has(externalId)) {
      return null;
    }
    trail.add(externalId);
    const item = itemByExternalId.get(externalId);
    if (!item) {
      return null;
    }
    if (item.type === "Epic") {
      rootEpicCache.set(externalId, item.external_id);
      return item.external_id;
    }
    const root = getRootEpicExternalId(item.parent_external_id, trail);
    rootEpicCache.set(externalId, root);
    return root;
  };

  db.prepare(
    "UPDATE documents SET summary = ?, assumptions_json = ?, missing_info_json = ? WHERE id = ?",
  ).run(
    aiResult?.summary || "",
    JSON.stringify(aiResult?.assumptions || []),
    JSON.stringify(Array.isArray(aiResult?.missing_info) ? aiResult.missing_info : []),
    documentId,
  );

  const insert = db.prepare(`
    INSERT INTO backlog_items (
      project_id, external_id, type, parent_id, epic_key, title, description, area, priority,
      story_points, estimate_hours, status, acceptance_criteria_json, dependencies_json,
      risks_json, labels_json, clarification_questions_json, source_chunk_id, source_snippet, updated_at
    ) VALUES (
      @project_id, @external_id, @type, @parent_id, @epic_key, @title, @description, @area,
      @priority, @story_points, @estimate_hours, @status, @acceptance_criteria_json,
      @dependencies_json, @risks_json, @labels_json, @clarification_questions_json, @source_chunk_id, @source_snippet, @updated_at
    )
  `);
  const updateParent = db.prepare(
    "UPDATE backlog_items SET parent_id = ?, epic_key = ? WHERE id = ?",
  );

  const externalMap = new Map();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    items.forEach((item) => {
      const info = insert.run({
        project_id: project.id,
        external_id: item.external_id,
        type: item.type,
        parent_id: null,
        epic_key: null,
        title: item.title,
        description: item.description || "",
        area: item.area || "other",
        priority: item.priority || "Medium",
        story_points: item.story_points ?? null,
        estimate_hours: item.estimate_hours ?? null,
        status: "todo",
        acceptance_criteria_json: JSON.stringify(item.acceptance_criteria || []),
        dependencies_json: JSON.stringify(item.dependencies || []),
        risks_json: JSON.stringify(item.risks || []),
        labels_json: JSON.stringify(item.labels || []),
        clarification_questions_json: JSON.stringify(item.clarification_questions || []),
        source_chunk_id: item.source_chunk_id || null,
        source_snippet: item.source_snippet || null,
        updated_at: now,
      });
      externalMap.set(item.external_id, info.lastInsertRowid);
    });

    items.forEach((item) => {
      const childId = externalMap.get(item.external_id);
      if (!childId) {
        return;
      }
      const parentId = item.parent_external_id ? externalMap.get(item.parent_external_id) : null;
      const epicKey = item.type === "Epic" ? null : getRootEpicExternalId(item.external_id);
      updateParent.run(parentId || null, epicKey || null, childId);
    });
  });
  tx();

  const missingInfo = Array.isArray(aiResult?.missing_info) ? aiResult.missing_info : [];
  missingInfo.forEach((question) => {
    insertChange(project.id, {
      from_version: version,
      to_version: version,
      change_type: "question",
      summary: question.question,
      affected_items_json: JSON.stringify({
        priority: question.priority,
        reason: question.reason,
      }),
    });
  });

  return {
    summary: aiResult?.summary || "",
    assumptions: aiResult?.assumptions || [],
    missing_info: missingInfo,
    created: items.length,
    projectId: project.id,
    documentId,
  };
}
