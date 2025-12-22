function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function snippet(text, limit = 140) {
  if (!text) {
    return "";
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, limit)}…`;
}

function detectAreas(text) {
  const lower = (text || "").toLowerCase();
  const areas = new Set();

  if (/(ui|frontend|interfaz|pantalla|web)/.test(lower)) {
    areas.add("frontend");
  }
  if (/(backend|servidor|negocio|l[oó]gica)/.test(lower)) {
    areas.add("backend");
  }
  if (/(api|endpoint|integraci[oó]n|rest|graphql)/.test(lower)) {
    areas.add("api");
  }
  if (/(base de datos|database|bd|sql|postgres|mysql)/.test(lower)) {
    areas.add("db");
  }
  if (/(qa|prueba|testing|test)/.test(lower)) {
    areas.add("qa");
  }
  if (/(devops|deploy|ci\/?cd|infraestructura|k8s|docker)/.test(lower)) {
    areas.add("devops");
  }
  if (/(seguridad|mfa|sso|auth|oauth|gdpr|iso|compliance|auditor[ií]a)/.test(lower)) {
    areas.add("security");
  }

  return areas.size ? Array.from(areas) : ["other"];
}

function buildMissingInfo(text) {
  const questions = [];
  const lower = (text || "").toLowerCase();
  if (/(por definir|pendiente|tbd|por confirmar)/.test(lower)) {
    questions.push({
      question: "Hay puntos pendientes. ¿Puedes confirmar el detalle exacto?",
      priority: "High",
      reason: "El documento marca items por definir.",
    });
  }
  return questions;
}

function extractBullets(content) {
  return (content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^(-|\*|\d+\.)/.test(line))
    .slice(0, 6);
}

function nextExternalId(counter) {
  return `T-${String(counter).padStart(3, "0")}`;
}

function buildAreaChecklist(area) {
  switch (area) {
    case "frontend":
      return [
        "Definir pantallas, estados y flujo principal.",
        "Implementar componentes y validaciones en UI.",
        "Revisar accesibilidad y comportamiento responsive.",
      ];
    case "backend":
      return [
        "Modelar la logica de negocio y servicios.",
        "Persistir datos y manejar errores.",
        "Registrar logs y metricas clave.",
      ];
    case "api":
      return [
        "Definir endpoints, contratos y payloads.",
        "Implementar validaciones y control de errores.",
        "Documentar API y ejemplos de uso.",
      ];
    case "db":
      return [
        "Diseñar esquema de datos e índices.",
        "Preparar migraciones y plan de rollback.",
        "Definir retención y copias de seguridad básicas.",
      ];
    case "qa":
      return [
        "Definir casos de prueba por escenario.",
        "Preparar pruebas de regresión.",
        "Validar criterios de aceptación con negocio.",
      ];
    case "devops":
      return [
        "Configurar pipeline de CI/CD y despliegue.",
        "Definir variables, secretos y entorno.",
        "Preparar monitorización y alertas iniciales.",
      ];
    case "security":
      return [
        "Definir políticas de acceso y roles.",
        "Revisar cumplimiento y auditoría básica.",
        "Validar mitigación de riesgos conocidos.",
      ];
    default:
      return [
        "Alinear alcance y prioridades con negocio.",
        "Detallar entregables y dependencias.",
        "Validar criterios de aceptacion.",
      ];
  }
}

function buildClarificationQuestions({ title, content, area, type }) {
  const questions = new Set();
  const lower = `${title || ""} ${content || ""}`.toLowerCase();

  if (/(mfa|sso|auth|oauth)/.test(lower)) {
    questions.add("¿Que proveedor de autenticacion se utilizara (Azure AD, Okta, etc.)?");
  }
  if (/(go-live|plazo|fecha|timeline|cronograma)/.test(lower)) {
    questions.add("¿Cual es la fecha objetivo de entrega o go-live?");
  }
  if (/(sla|soporte|support)/.test(lower)) {
    questions.add("¿Que nivel de SLA y horario de soporte se requiere?");
  }
  if (/(integracion|api|endpoint|rest|graphql)/.test(lower)) {
    questions.add("¿Que sistemas externos o consumidores usarian la integracion?");
  }

  if (area === "frontend") {
    questions.add("¿Hay guias de diseno o branding que debamos seguir?");
  }
  if (area === "backend") {
    questions.add("¿Que reglas de negocio o excepciones clave existen?");
  }
  if (area === "db") {
    questions.add("¿Que politica de retencion o borrado de datos aplica?");
  }
  if (area === "qa") {
    questions.add("¿Que entornos de prueba estan disponibles?");
  }
  if (area === "devops") {
    questions.add("¿En qué entorno se desplegará (cloud/on-prem) y con qué restricciones?");
  }
  if (area === "security") {
    questions.add("¿Que normativas de seguridad o compliance aplican?");
  }

  if (type === "Epic") {
    questions.add("¿Quien es el sponsor y quien aprueba el alcance?");
  }

  if (questions.size === 0) {
    questions.add("¿Quien es el usuario final principal?");
    questions.add("¿Cual es el criterio de exito para esta entrega?");
  }

  return Array.from(questions).slice(0, 4);
}

function buildDescriptionBlock({ title, content, area, type, context }) {
  const cleanTitle = title || "Entrega";
  const docSummary = snippet(content, 160);
  const areaLabel = area && area !== "other" ? area : "equipo";
  const plainExplanation =
    type === "Epic"
      ? `En términos sencillos, este subproyecto agrupa trabajo relacionado para entregar una parte coherente del alcance. Sirve para coordinar qué se entrega, cuándo y con qué criterios.`
      : type === "Story"
        ? `En términos sencillos, esta historia describe una necesidad concreta del usuario/negocio. El objetivo es que el resultado sea verificable y pueda validarse sin conocimientos técnicos.`
        : `En términos sencillos, esta tarea es un trabajo específico del ${areaLabel}. Su objetivo es implementar una parte del alcance de forma segura y verificable.`;
  const baseBullets =
    type === "Epic"
      ? [
          "Definir alcance, hitos y entregables principales.",
          "Alinear dependencias con stakeholders.",
          "Validar riesgos y criterios de éxito.",
        ]
      : type === "Story"
        ? [
            "Detallar el flujo principal y casos borde.",
            "Definir criterios de aceptación claros.",
            "Validar con negocio antes de desarrollar.",
          ]
        : [
            "Implementar el entregable con pruebas básicas.",
            "Coordinar cambios con el equipo responsable.",
            "Dejar evidencia de validación funcional.",
          ];
  const areaBullets = buildAreaChecklist(area);
  const bulletLines = Array.from(new Set([...baseBullets, ...areaBullets])).slice(0, 5);
  const requirements = extractBullets(content).map((line) =>
    `- ${line.replace(/^(-|\*|\d+\.)\s*/, "")}`,
  );

  const sections = [
    `**Objetivo:** ${cleanTitle}`,
    `**Explicación sencilla:** ${plainExplanation}`,
    bulletLines.length
      ? `**Qué haremos:**\n${bulletLines.map((item) => `- ${item}`).join("\n")}`
      : "",
    requirements.length ? `**Requisitos detectados:**\n${requirements.join("\n")}` : "",
    context ? `**Contexto:** ${snippet(context, 140)}` : "",
    docSummary ? `**Referencia:** ${docSummary}` : "",
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function buildLocalPlan(chunks, context = "") {
  let counter = 1;
  const items = [];
  const missing_info = [];
  const contextText = snippet((context || "").trim(), 160);
  const topicLines = (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => (chunk?.title || "General").trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((title) => `- ${title}`);

  chunks.forEach((chunk) => {
    const epicId = nextExternalId(counter++);
    const chunkAreas = detectAreas(chunk.content).slice(0, 2);
    items.push({
      external_id: epicId,
      type: "Epic",
      parent_external_id: null,
      title: `Subproyecto: ${chunk.title || "Requisitos"}`,
      description: buildDescriptionBlock({
        title: `Subproyecto: ${chunk.title || "Requisitos"}`,
        content: chunk.content,
        area: chunkAreas[0] || "other",
        type: "Epic",
        context,
      }),
      area: chunkAreas[0] || "other",
      priority: "Medium",
      story_points: 8,
      estimate_hours: 16,
      acceptance_criteria: [`Cobertura de ${chunk.title || "requisitos"}`],
      dependencies: [],
      labels: ["local-basic"],
      risks: [],
      clarification_questions: buildClarificationQuestions({
        title: chunk.title,
        content: chunk.content,
        area: chunkAreas[0] || "other",
        type: "Epic",
      }),
      source_chunk_id: chunk.chunk_id,
      source_snippet: snippet(chunk.content, 160),
    });

    const bullets = extractBullets(chunk.content);
    const featureTitles =
      bullets.length > 0
        ? bullets.map((line) => line.replace(/^(-|\*|\d+\.)\s*/, ""))
        : [`${chunk.title || "Feature principal"}`];

    featureTitles.slice(0, 4).forEach((featureTitle) => {
      const storyExternalId = nextExternalId(counter++);
      const storyArea = detectAreas(`${featureTitle}\n${chunk.content}`)[0] || chunkAreas[0] || "other";
      items.push({
        external_id: storyExternalId,
        type: "Story",
        parent_external_id: epicId,
        title: featureTitle,
        description: buildDescriptionBlock({
          title: featureTitle,
          content: chunk.content,
          area: storyArea,
          type: "Story",
          context,
        }),
        area: storyArea,
        priority: "Medium",
        story_points: Math.min(8, Math.max(2, Math.ceil(featureTitle.length / 50))),
        estimate_hours: Math.min(16, Math.max(4, Math.ceil(featureTitle.length / 20))),
        acceptance_criteria: ["Validado con negocio", "Probado end-to-end"],
        dependencies: [],
        labels: ["local-basic", "feature"],
        risks: [],
        clarification_questions: buildClarificationQuestions({
          title: featureTitle,
          content: chunk.content,
          area: storyArea,
          type: "Story",
        }),
        source_chunk_id: chunk.chunk_id,
        source_snippet: snippet(featureTitle, 140),
      });

      // Generar 2-4 User Stories por feature (Task = US), incluyendo QA por defecto.
      const detectedAreas = detectAreas(`${featureTitle}\n${chunk.content}`).filter((area) => area !== "other");
      const usAreas = Array.from(new Set([...detectedAreas, "qa"]));
      const finalAreas =
        usAreas.length >= 2 ? usAreas.slice(0, 3) : Array.from(new Set([storyArea, "qa"])).slice(0, 2);

      finalAreas.forEach((area) => {
        const usTitle = `US (${area}): ${featureTitle}`.slice(0, 140);
        items.push({
          external_id: nextExternalId(counter++),
          type: "Task",
          parent_external_id: storyExternalId,
          title: usTitle,
          description: buildDescriptionBlock({
            title: usTitle,
            content: chunk.content,
            area,
            type: "Task",
            context,
          }),
          area,
          priority: "Medium",
          story_points: 2,
          estimate_hours: 4,
          acceptance_criteria: ["Criterios de aceptación validados", "Evidencia de pruebas básica"],
          dependencies: [],
          labels: ["local-basic", "us", area],
          risks: [],
          clarification_questions: buildClarificationQuestions({
            title: usTitle,
            content: chunk.content,
            area,
            type: "Task",
          }),
          source_chunk_id: chunk.chunk_id,
          source_snippet: snippet(featureTitle, 140),
        });
      });
    });

    missing_info.push(...buildMissingInfo(chunk.content));
  });

  return {
    summary: [
      `**Resumen del documento**`,
      contextText ? `**Contexto:** ${contextText}` : "",
      topicLines.length ? `**Secciones detectadas:**\n${topicLines.join("\n")}` : "",
      `**Resultado:** propuesta inicial de subproyectos y tareas para iniciar la planificación.`,
      `**Siguiente paso:** valida supuestos y responde las preguntas antes de comprometer fechas.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    assumptions: [
      "Estimaciones iniciales aproximadas (sin calibración histórica).",
      "Dependencias sugeridas por orden de aparición (validar con el equipo).",
    ],
    missing_info,
    items,
  };
}

export function buildLocalDescription(title, area = "other", content = "", context = "") {
  return {
    description: buildDescriptionBlock({
      title,
      content,
      area,
      type: "Task",
      context,
    }),
    clarification_questions: buildClarificationQuestions({
      title,
      content,
      area,
      type: "Task",
    }),
  };
}

export function buildLocalAsk(question, topChunks) {
  const qTokens = new Set(tokenize(question));
  let best = null;
  let bestScore = 0;

  topChunks.forEach((chunk) => {
    const tokens = tokenize(`${chunk.title} ${chunk.content}`);
    const overlap = tokens.filter((token) => qTokens.has(token)).length;
    const score = qTokens.size ? overlap / qTokens.size : 0;
    if (score > bestScore) {
      bestScore = score;
      best = chunk;
    }
  });

  if (!best || bestScore < 0.05) {
    return {
      answer:
        "**No aparece en el documento con claridad.**\n\n- Comparte el fragmento relevante.\n- Indica la seccion exacta para revisarla.",
      citations: [],
      if_not_found: true,
      follow_up_questions: [
        "¿Puedes compartir más detalle o un extracto específico?",
      ],
    };
  }

  const citeSnippet = snippet(best.content, 160);
  const detailBullets = extractBullets(best.content)
    .map((line) => `- ${line.replace(/^(-|\*|\d+\.)\s*/, "")}`)
    .slice(0, 4);
  return {
    answer: `**Respuesta breve:** ${citeSnippet}${
      detailBullets.length ? `\n\n**Detalle:**\n${detailBullets.join("\n")}` : ""
    }`,
    citations: [{ chunk_id: best.chunk_id, snippet: citeSnippet }],
    if_not_found: false,
    follow_up_questions: ["¿Quieres que lo convierta en tarea específica?"],
  };
}

export function buildLocalReconcile(changes, backlogItems, newChunks) {
  let counter = backlogItems.length + 100;
  const nextId = () => nextExternalId(counter++);
  const create_items = [];
  const update_items = [];
  const mark_obsolete = [];
  const questions_for_client = [];

  const bySource = new Map();
  backlogItems.forEach((item) => {
    if (!item.source_chunk_id) {
      return;
    }
    if (!bySource.has(item.source_chunk_id)) {
      bySource.set(item.source_chunk_id, []);
    }
    bySource.get(item.source_chunk_id).push(item);
  });

  changes.forEach((change) => {
    if (change.change_type === "added") {
      const chunk = newChunks.find((item) => item.chunk_id === change.new_chunk_id) || {};
      const areas = detectAreas(chunk.content || "");
      create_items.push({
        external_id: nextId(),
        type: "Story",
        parent_external_id: null,
        title: `Nuevo: ${chunk.title || change.summary}`,
        description: buildDescriptionBlock({
          title: `Nuevo: ${chunk.title || change.summary}`,
          content: chunk.content || change.summary,
          area: areas[0] || "other",
          type: "Story",
        }),
        area: areas[0] || "other",
        priority: "High",
        story_points: 3,
        estimate_hours: 6,
        acceptance_criteria: ["Alineado con el cliente", "Listo para desarrollo"],
        dependencies: [],
        labels: ["local-basic"],
        risks: [],
        clarification_questions: buildClarificationQuestions({
          title: chunk.title || change.summary,
          content: chunk.content || change.summary,
          area: areas[0] || "other",
          type: "Story",
        }),
        source_chunk_id: change.new_chunk_id,
        source_snippet: snippet(chunk.content || change.summary, 140),
      });
      return;
    }

    if (change.change_type === "modified") {
      const candidates = [change.old_chunk_id, change.new_chunk_id]
        .filter(Boolean)
        .flatMap((id) => bySource.get(id) || []);
      if (candidates.length === 0) {
        questions_for_client.push({
          question: `Se modificó un bloque (${change.summary}). ¿Qué tarea afecta?`,
          priority: "Medium",
          reason: "No se encontró trazabilidad directa.",
        });
        return;
      }
      update_items.push({
        external_id: candidates[0].external_id,
        patch: {
          description: `${candidates[0].description}\n\n[Actualizado por cambio detectado]`,
          priority: "Medium",
        },
      });
      return;
    }

    if (change.change_type === "removed") {
      const affected = (bySource.get(change.old_chunk_id) || []).map(
        (item) => item.external_id,
      );
      if (affected.length === 0) {
        questions_for_client.push({
          question: `Se eliminó un bloque (${change.summary}). ¿Qué tareas deben cerrarse?`,
          priority: "Low",
          reason: "No se encontraron tareas asociadas.",
        });
        return;
      }
      mark_obsolete.push(...affected);
    }
  });

  return {
    create_items,
    update_items,
    mark_obsolete,
    questions_for_client,
  };
}

export function buildLocalChat(messages) {
  const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
  const text = (lastUser?.content || "").trim();
  if (!text) {
    return { answer: "**Hola**. Dime en qué te puedo ayudar." };
  }

  const lower = text.toLowerCase();
  if (/(hola|buenas|hello|hi)/.test(lower)) {
    return { answer: "**Hola**. ¿Qué te gustaría preguntar?" };
  }
  if (/(ayuda|help|que puedes hacer)/.test(lower)) {
    return {
      answer:
        "**Modo local básico.**\n\n- Configura `AI_API_KEY` o `LOCAL_AI_URL` para respuestas completas.\n- Puedo ayudarte con preguntas cortas y estructura básica.",
    };
  }
  if (/(gracias|thanks)/.test(lower)) {
    return { answer: "**De nada.** Si quieres, pregúntame otra cosa." };
  }

  return {
    answer:
      "**Respuesta limitada (modo local básico).**\n\n- Para respuestas tipo ChatGPT configura `AI_API_KEY` o `LOCAL_AI_URL`.\n- Si compartes más detalle, podré ayudarte mejor.",
  };
}
