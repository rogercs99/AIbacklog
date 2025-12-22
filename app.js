const STORAGE_KEYS = {
  statuses: "deltascope_statuses",
  lang: "deltascope_lang",
};

const translations = {
  es: {
    strings: {
      pageTitle: "DeltaScope AI - Inteligencia de cambios",
      logoTag: "Inteligencia de cambios",
      navStory: "Cómo funciona",
      navVideo: "Video",
      navDemo: "Demo",
      navImpact: "Impacto",
      navExports: "Exportables",
      loadDemo: "Cargar demo",
      compareNow: "Comparar ahora",
      heroPill: "Inspirado en NTT DATA",
      heroTitle: "DeltaScope AI convierte cambios de documentos en un plan accionable en minutos.",
      heroLead:
        "Sube una versión base y una nueva. Te dice qué cambió y qué hacer después, sin tecnicismos. Úsalo cuando recibes una versión nueva de requisitos, un contrato, un alcance o un plan y necesitas alinear al equipo rápido.",
      stepOneTitle: "Carga la versión base",
      stepOneDesc: "Arrastra un PDF, DOCX o TXT con el baseline aprobado.",
      stepTwoTitle: "Sube la nueva versión",
      stepTwoDesc: "DeltaScope identifica cambios estructurales y numéricos.",
      stepThreeTitle: "Revisa impacto",
      stepThreeDesc: "Tienes lista de cambios, impacto y plan de acción exportable.",
      loadInstant: "Ver demo instantánea",
      clearData: "Limpiar datos",
      backendUnknown: "Backend sin estado",
      backendConnected: "Backend conectado",
      backendLocal: "Backend offline (modo local)",
      metricTotal: "cambios detectados",
      metricCritical: "cambios críticos",
      metricSchedule: "impactos en plazos",
      metricCompliance: "riesgos compliance",
      videoTitle: "Video explicativo",
      videoSubtitle: "Entiende en menos de dos minutos qué es y cómo se usa.",
      videoDuration: "1:26 min",
      videoFallback: "Tu navegador no soporta video HTML5.",
      videoCaption: "Resumen visual del flujo DeltaScope AI.",
      videoReplay: "Reproducir de nuevo",
      storyTitle: "Así funciona el comparador inteligente",
      storySubtitle:
        "Cada bloque activa una herramienta real en pantalla para que el jurado lo entienda en segundos.",
      storyStepUploadTitle: "Entrada de versiones",
      storyStepUploadBody:
        "Unifica baseline y nueva versión en un solo flujo. Todo listo para analizar.",
      storyStepDiffTitle: "Diff inteligente",
      storyStepDiffBody:
        "Detecta cambios reales, estructurales y numéricos. No más comparación manual.",
      storyStepImpactTitle: "Impacto accionable",
      storyStepImpactBody:
        "Clasifica por área y severidad. El impacto aparece listo para decisión.",
      storyStepExportTitle: "Comunicación y trazabilidad",
      storyStepExportBody:
        "Genera plan de acción, change log y comunicados en un clic.",
      toolUploadKicker: "Workspace",
      toolUploadTitle: "Carga de versiones",
      toolUploadBadge: "Entrada segura",
      toolUploadBaseline: "Baseline",
      toolUploadRevised: "Nueva versión",
      toolUploadHint: "Arrastra archivos",
      toolDiffKicker: "Diff inteligente",
      toolDiffTitle: "Mapa de cambios",
      toolDiffBadge: "Precisión de línea",
      toolDiffSummary: "cambios detectados",
      toolDiffAdded: "Agregado",
      toolDiffModified: "Modificado",
      toolDiffRemoved: "Eliminado",
      toolDiffRowOne: "Dashboard de riesgos operativos",
      toolDiffRowTwo: "SLA disponibilidad 99,9%",
      toolDiffRowThree: "Ventana de despliegue de 2 horas",
      toolImpactKicker: "Impacto",
      toolImpactTitle: "Panel de impacto",
      toolImpactBadge: "Matriz IA",
      toolImpactScope: "Scope",
      toolImpactSchedule: "Plazos",
      toolImpactCost: "Coste",
      toolImpactRisk: "Riesgos",
      toolImpactCompliance: "Compliance",
      toolImpactNote: "2 cambios críticos requieren decisión ejecutiva",
      toolExportKicker: "Salida",
      toolExportTitle: "Pack de comunicaciones",
      toolExportBadge: "Listo para enviar",
      toolExportLog: "Change log",
      toolExportImpact: "Evaluación de impacto",
      toolExportEmail: "Email stakeholders",
      toolExportAgenda: "Agenda reunión",
      toolExportNote: "Descarga en 1 clic",
      impactPanelTitle: "Panel de impacto",
      impactSummaryEmpty: "Sin análisis",
      impactPlanTitle: "Plan de acción sugerido",
      impactPlanEmpty: "Sube documentos para ver acciones.",
      uploadTitle: "Sube tus versiones",
      uploadSubtitle: "PDF, DOCX o TXT. También puedes pegar texto directo para una demo rápida.",
      stepOneLabel: "Paso 1",
      stepTwoLabel: "Paso 2",
      baselineTitle: "Documento A",
      baselineBadge: "Baseline",
      revisedTitle: "Documento B",
      revisedBadge: "Nueva versión",
      dropTitle: "Arrastra tu archivo aquí",
      fileEmpty: "Sin archivo seleccionado",
      selectFile: "Seleccionar archivo",
      pasteLabel: "O pega texto",
      baselinePlaceholder: "Pega aquí la versión base para comparar",
      revisedPlaceholder: "Pega aquí la versión nueva para comparar",
      compareButton: "Comparar",
      swapButton: "Intercambiar versiones",
      compareHintReady: "Listo para comparar.",
      compareHintNeed: "Listo para analizar cuando ambos textos tengan contenido.",
      resultsTitle: "Resultados y trazabilidad",
      resultsSubtitle: "Filtra cambios, valida impacto y exporta para el equipo.",
      exportLog: "Exportar change log",
      exportImpact: "Exportar impacto",
      exportEmail: "Email stakeholders",
      exportAgenda: "Agenda reunión",
      filtersArea: "Área",
      filtersSeverity: "Severidad",
      filtersStatus: "Estado",
      filterAll: "Todas",
      filterScope: "Scope",
      filterSchedule: "Plazos",
      filterCost: "Coste",
      filterRisk: "Riesgo",
      filterCompliance: "Compliance",
      filterTesting: "Testing",
      filterGeneral: "General",
      filterHigh: "Alta",
      filterMedium: "Media",
      filterLow: "Baja",
      filterPending: "Pendiente",
      filterAccepted: "Aceptado",
      filterRejected: "Rechazado",
      filterClarify: "Requiere aclaración",
      changesListTitle: "Lista de cambios",
      changesCount: "{count} cambios",
      changesEmpty: "Aún no hay cambios detectados.",
      changesEmptyFiltered: "No hay cambios con los filtros actuales.",
      detailTitle: "Detalle del cambio",
      detailEmptyBadge: "Selecciona un cambio",
      detailEmpty: "Selecciona un cambio para ver detalle.",
      detailSectionLabel: "Sección",
      detailReasonsLabel: "Motivos",
      detailBefore: "Antes",
      detailAfter: "Después",
      detailActions: "Acciones sugeridas",
      loadingText: "Analizando cambios y generando impacto...",
      footerNote:
        "DeltaScope AI MVP - Análisis local con diff inteligente + heurísticas de impacto.",
      statusReadingFile: "Leyendo {name}...",
      statusFileLoaded: "Archivo cargado: {name}",
      statusFileError: "Error al leer {name}: {error}",
      statusNeedBoth: "Carga ambos documentos para comparar.",
      statusNoChanges: "No se detectaron cambios.",
      statusAnalysisDone: "Análisis completado.",
      statusAnalysisError: "Error en análisis: {error}",
      statusDataCleared: "Datos limpiados.",
      statusSwapped: "Versiones intercambiadas.",
      statusExportEmpty: "No hay cambios para exportar.",
      statusDemoLoaded: "Demo cargada. Puedes comparar ahora.",
      impactSummary: "{critical} críticos / {total} cambios",
      changeLabel: "Cambio",
      errorNoText: "No se pudo extraer texto.",
      errorPdfParser: "Parser PDF no disponible.",
      errorDocxParser: "Parser DOCX no disponible.",
      impactScope: "Scope",
      impactSchedule: "Plazos",
      impactCost: "Coste",
      impactRisk: "Riesgos",
      impactCompliance: "Compliance",
      impactTesting: "Testing",
      langToggle: "Cambiar idioma",
      exportImpactTitle: "DeltaScope AI - Impacto",
      exportImpactTotal: "Cambios detectados: {total}",
      exportImpactCritical: "Críticos: {critical}",
      exportSummaryByArea: "Resumen por área:",
      exportActionsSuggested: "Acciones sugeridas:",
      exportEmailSubject: "Asunto: Impacto cambios en requisitos - DeltaScope AI",
      exportEmailGreeting: "Hola equipo,",
      exportEmailIntro: "Hemos comparado la versión base vs la versión nueva. Resumen:",
      exportEmailImpactTitle: "Impactos principales:",
      exportEmailActionsTitle: "Acciones sugeridas:",
      exportEmailChangesTitle: "Cambios principales:",
      exportEmailOutro: "Quedo atento/a para alinear siguientes pasos.",
      exportAgendaTitle: "Agenda - Reunión de alineación de cambios",
      exportAgendaSummary: "1. Resumen de cambios detectados",
      exportAgendaTotal: "   - Total: {total}",
      exportAgendaCritical: "2. Cambios críticos y decisiones",
      exportAgendaPlan: "3. Impacto en plan y presupuesto",
      exportAgendaTesting: "4. Ajustes en testing y compliance",
      exportAgendaActions: "5. Acciones y responsables",
    },
    labels: {
      areas: {
        scope: "Scope",
        schedule: "Plazos",
        cost: "Coste",
        risk: "Riesgo",
        compliance: "Compliance",
        testing: "Testing",
        general: "General",
      },
      severity: {
        high: "Alta",
        medium: "Media",
        low: "Baja",
      },
      status: {
        pending: "Pendiente",
        accepted: "Aceptado",
        rejected: "Rechazado",
        clarify: "Requiere aclaración",
      },
      changeType: {
        added: "Agregado",
        removed: "Eliminado",
        modified: "Modificado",
      },
    },
  },
  en: {
    strings: {
      pageTitle: "DeltaScope AI - Change intelligence",
      logoTag: "Change intelligence",
      navStory: "How it works",
      navVideo: "Video",
      navDemo: "Upload",
      navImpact: "Impact",
      navExports: "Exports",
      loadDemo: "Load demo",
      compareNow: "Compare now",
      heroPill: "NTT DATA inspired",
      heroTitle: "DeltaScope AI turns document changes into an actionable plan in minutes.",
      heroLead:
        "Upload a baseline and a new version. It tells you what changed and what to do next, in plain language. Use it when a client sends a new version of requirements, a contract, a scope document, or a plan and you need to align the team fast.",
      stepOneTitle: "Load the baseline",
      stepOneDesc: "Drag a PDF, DOCX, or TXT with the approved baseline.",
      stepTwoTitle: "Upload the new version",
      stepTwoDesc: "DeltaScope spots structural and numeric changes.",
      stepThreeTitle: "Review impact",
      stepThreeDesc: "Get change list, impact, and an exportable action plan.",
      loadInstant: "Instant demo",
      clearData: "Clear data",
      backendUnknown: "Backend status unknown",
      backendConnected: "Backend connected",
      backendLocal: "Backend offline (local mode)",
      metricTotal: "changes detected",
      metricCritical: "critical changes",
      metricSchedule: "schedule impacts",
      metricCompliance: "compliance risks",
      videoTitle: "Explainer video",
      videoSubtitle: "Understand what it is and how it works in under two minutes.",
      videoDuration: "1:26 min",
      videoFallback: "Your browser does not support HTML5 video.",
      videoCaption: "Visual overview of the DeltaScope AI flow.",
      videoReplay: "Replay video",
      storyTitle: "How the intelligent comparison works",
      storySubtitle:
        "Each block activates a real tool on screen so the jury gets it in seconds.",
      storyStepUploadTitle: "Version intake",
      storyStepUploadBody:
        "Unify baseline and new version in one flow. Ready to analyze.",
      storyStepDiffTitle: "Smart diff",
      storyStepDiffBody:
        "Detect real, structural, and numeric changes. No manual comparison.",
      storyStepImpactTitle: "Actionable impact",
      storyStepImpactBody:
        "Classify by area and severity. Impact is ready for decision.",
      storyStepExportTitle: "Comms and traceability",
      storyStepExportBody:
        "Generate action plan, change log, and communications in one click.",
      toolUploadKicker: "Workspace",
      toolUploadTitle: "Version intake",
      toolUploadBadge: "Secure intake",
      toolUploadBaseline: "Baseline",
      toolUploadRevised: "New version",
      toolUploadHint: "Drag files",
      toolDiffKicker: "Smart diff",
      toolDiffTitle: "Change map",
      toolDiffBadge: "Line precision",
      toolDiffSummary: "changes detected",
      toolDiffAdded: "Added",
      toolDiffModified: "Modified",
      toolDiffRemoved: "Removed",
      toolDiffRowOne: "Operational risk dashboard",
      toolDiffRowTwo: "SLA availability 99.9%",
      toolDiffRowThree: "Deployment window 2 hours",
      toolImpactKicker: "Impact",
      toolImpactTitle: "Impact panel",
      toolImpactBadge: "AI matrix",
      toolImpactScope: "Scope",
      toolImpactSchedule: "Schedule",
      toolImpactCost: "Cost",
      toolImpactRisk: "Risk",
      toolImpactCompliance: "Compliance",
      toolImpactNote: "2 critical changes need executive decision",
      toolExportKicker: "Output",
      toolExportTitle: "Comms pack",
      toolExportBadge: "Ready to send",
      toolExportLog: "Change log",
      toolExportImpact: "Impact assessment",
      toolExportEmail: "Stakeholder email",
      toolExportAgenda: "Meeting agenda",
      toolExportNote: "One-click download",
      impactPanelTitle: "Impact panel",
      impactSummaryEmpty: "No analysis yet",
      impactPlanTitle: "Suggested action plan",
      impactPlanEmpty: "Upload documents to see actions.",
      uploadTitle: "Upload your versions",
      uploadSubtitle: "PDF, DOCX, or TXT. You can also paste text for a quick demo.",
      stepOneLabel: "Step 1",
      stepTwoLabel: "Step 2",
      baselineTitle: "Document A",
      baselineBadge: "Baseline",
      revisedTitle: "Document B",
      revisedBadge: "New version",
      dropTitle: "Drag your file here",
      fileEmpty: "No file selected",
      selectFile: "Select file",
      pasteLabel: "Or paste text",
      baselinePlaceholder: "Paste the baseline version to compare",
      revisedPlaceholder: "Paste the new version to compare",
      compareButton: "Compare",
      swapButton: "Swap versions",
      compareHintReady: "Ready to compare.",
      compareHintNeed: "Add content to both fields to analyze.",
      resultsTitle: "Results and traceability",
      resultsSubtitle: "Filter changes, validate impact, and export for the team.",
      exportLog: "Export change log",
      exportImpact: "Export impact",
      exportEmail: "Stakeholder email",
      exportAgenda: "Meeting agenda",
      filtersArea: "Area",
      filtersSeverity: "Severity",
      filtersStatus: "Status",
      filterAll: "All",
      filterScope: "Scope",
      filterSchedule: "Schedule",
      filterCost: "Cost",
      filterRisk: "Risk",
      filterCompliance: "Compliance",
      filterTesting: "Testing",
      filterGeneral: "General",
      filterHigh: "High",
      filterMedium: "Medium",
      filterLow: "Low",
      filterPending: "Pending",
      filterAccepted: "Accepted",
      filterRejected: "Rejected",
      filterClarify: "Needs clarification",
      changesListTitle: "Change list",
      changesCount: "{count} changes",
      changesEmpty: "No changes detected yet.",
      changesEmptyFiltered: "No changes match the current filters.",
      detailTitle: "Change detail",
      detailEmptyBadge: "Select a change",
      detailEmpty: "Select a change to see the detail.",
      detailSectionLabel: "Section",
      detailReasonsLabel: "Reasons",
      detailBefore: "Before",
      detailAfter: "After",
      detailActions: "Suggested actions",
      loadingText: "Analyzing changes and generating impact...",
      footerNote: "DeltaScope AI MVP - Local diff with impact heuristics.",
      statusReadingFile: "Reading {name}...",
      statusFileLoaded: "File loaded: {name}",
      statusFileError: "Failed to read {name}: {error}",
      statusNeedBoth: "Upload both documents to compare.",
      statusNoChanges: "No changes detected.",
      statusAnalysisDone: "Analysis completed.",
      statusAnalysisError: "Analysis error: {error}",
      statusDataCleared: "Data cleared.",
      statusSwapped: "Versions swapped.",
      statusExportEmpty: "No changes to export.",
      statusDemoLoaded: "Demo loaded. You can compare now.",
      impactSummary: "{critical} critical / {total} changes",
      changeLabel: "Change",
      errorNoText: "Could not extract text.",
      errorPdfParser: "PDF parser not available.",
      errorDocxParser: "DOCX parser not available.",
      impactScope: "Scope",
      impactSchedule: "Schedule",
      impactCost: "Cost",
      impactRisk: "Risk",
      impactCompliance: "Compliance",
      impactTesting: "Testing",
      langToggle: "Switch language",
      exportImpactTitle: "DeltaScope AI - Impact",
      exportImpactTotal: "Changes detected: {total}",
      exportImpactCritical: "Critical: {critical}",
      exportSummaryByArea: "Summary by area:",
      exportActionsSuggested: "Suggested actions:",
      exportEmailSubject: "Subject: Impact of requirement changes - DeltaScope AI",
      exportEmailGreeting: "Hello team,",
      exportEmailIntro: "We compared the baseline vs the new version. Summary:",
      exportEmailImpactTitle: "Key impacts:",
      exportEmailActionsTitle: "Suggested actions:",
      exportEmailChangesTitle: "Main changes:",
      exportEmailOutro: "Let me know so we can align next steps.",
      exportAgendaTitle: "Agenda - Change alignment meeting",
      exportAgendaSummary: "1. Summary of detected changes",
      exportAgendaTotal: "   - Total: {total}",
      exportAgendaCritical: "2. Critical changes and decisions",
      exportAgendaPlan: "3. Impact on plan and budget",
      exportAgendaTesting: "4. Testing and compliance updates",
      exportAgendaActions: "5. Actions and owners",
    },
    labels: {
      areas: {
        scope: "Scope",
        schedule: "Schedule",
        cost: "Cost",
        risk: "Risk",
        compliance: "Compliance",
        testing: "Testing",
        general: "General",
      },
      severity: {
        high: "High",
        medium: "Medium",
        low: "Low",
      },
      status: {
        pending: "Pending",
        accepted: "Accepted",
        rejected: "Rejected",
        clarify: "Needs clarification",
      },
      changeType: {
        added: "Added",
        removed: "Removed",
        modified: "Modified",
      },
    },
  },
};

const samples = {
 es: {
    baseline: `
1. Alcance
- El sistema debe permitir alta de usuarios internos.
- Se entregará un panel de reportes semanal.

2. Plazos
- Fecha de go-live: 30/06/2024.
- Ventana de despliegue: 2 horas.

3. SLA
- Disponibilidad mínima 99.5% mensual.
- Tiempo de respuesta máximo 2s.

4. Seguridad y compliance
- Cumplimiento ISO 27001.
- Acceso solo con MFA.
`,
    revised: `
1. Alcance
- El sistema debe permitir alta de usuarios internos y externos.
- Se entregará un panel de reportes diario.
- Se agrega dashboard de riesgos operativos.

2. Plazos
- Fecha de go-live: 15/07/2024.
- Ventana de despliegue: 4 horas.

3. SLA
- Disponibilidad mínima 99.9% mensual.
- Tiempo de respuesta máximo 1.5s.
- Penalización por incumplimiento SLA.

4. Seguridad y compliance
- Cumplimiento ISO 27001 y GDPR.
- Acceso con MFA y auditoría de accesos.

5. Testing
- Pruebas de carga obligatorias antes del go-live.
`,
  },
  en: {
    baseline: `
1. Scope
- The system must allow onboarding for internal users.
- Weekly reporting dashboard will be delivered.

2. Schedule
- Go-live date: 06/30/2024.
- Deployment window: 2 hours.

3. SLA
- Minimum availability 99.5% monthly.
- Max response time 2s.

4. Security and compliance
- ISO 27001 compliance.
- MFA required for access.
`,
    revised: `
1. Scope
- The system must allow onboarding for internal and external users.
- Daily reporting dashboard will be delivered.
- Add operational risk dashboard.

2. Schedule
- Go-live date: 07/15/2024.
- Deployment window: 4 hours.

3. SLA
- Minimum availability 99.9% monthly.
- Max response time 1.5s.
- SLA penalty clause.

4. Security and compliance
- ISO 27001 and GDPR compliance.
- MFA and access audit required.

5. Testing
- Load testing required before go-live.
`,
  },
};

const state = {
  baselineText: "",
  revisedText: "",
  changes: [],
  selectedId: null,
  filters: {
    area: "all",
    severity: "all",
    status: "all",
  },
  statusMap: {},
  files: {
    baseline: null,
    revised: null,
  },
  lang: "es",
  backendAvailable: null,
};

const statusMessage = document.getElementById("statusMessage");
const statTotal = document.getElementById("statTotal");
const statCritical = document.getElementById("statCritical");
const statSchedule = document.getElementById("statSchedule");
const statCompliance = document.getElementById("statCompliance");
const impactSummary = document.getElementById("impactSummary");

const impactScope = document.getElementById("impactScope");
const impactSchedule = document.getElementById("impactSchedule");
const impactCost = document.getElementById("impactCost");
const impactRisk = document.getElementById("impactRisk");
const impactCompliance = document.getElementById("impactCompliance");
const impactTesting = document.getElementById("impactTesting");

const actionList = document.getElementById("actionList");
const changesList = document.getElementById("changesList");
const changesCount = document.getElementById("changesCount");
const detailBadge = document.getElementById("detailBadge");
const detailBody = document.getElementById("detailBody");
const compareButton = document.getElementById("compareButton");
const compareTop = document.getElementById("compareTop");
const compareHint = document.getElementById("compareHint");
const loadingOverlay = document.getElementById("loadingOverlay");

const textBaseline = document.getElementById("textBaseline");
const textRevised = document.getElementById("textRevised");
const fileBaseline = document.getElementById("fileBaseline");
const fileRevised = document.getElementById("fileRevised");
const fileNameBaseline = document.getElementById("fileNameBaseline");
const fileNameRevised = document.getElementById("fileNameRevised");

const filterArea = document.getElementById("filterArea");
const filterSeverity = document.getElementById("filterSeverity");
const filterStatus = document.getElementById("filterStatus");

const exportLog = document.getElementById("exportLog");
const exportImpact = document.getElementById("exportImpact");
const exportEmail = document.getElementById("exportEmail");
const exportAgenda = document.getElementById("exportAgenda");

const backendStatus = document.getElementById("backendStatus");
const langButtons = document.querySelectorAll(".lang-button");
const scrollProgress = document.querySelector(".scroll-progress");
const revealItems = document.querySelectorAll(".reveal");
const storySteps = document.querySelectorAll(".story-step");
const toolCards = document.querySelectorAll(".tool-card");
const videoFrame = document.querySelector(".video-frame");
const replayButton = document.querySelector("[data-video-action=\"replay\"]");

function init() {
  state.lang = loadLanguage();
  state.statusMap = loadStatusMap();

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  setupDropZone("baseline");
  setupDropZone("revised");

  fileBaseline.addEventListener("change", (event) =>
    handleFile(event.target.files[0], "baseline"),
  );
  fileRevised.addEventListener("change", (event) =>
    handleFile(event.target.files[0], "revised"),
  );

  textBaseline.addEventListener("input", updateCompareHint);
  textRevised.addEventListener("input", updateCompareHint);

  document.getElementById("loadSample").addEventListener("click", loadSample);
  document
    .getElementById("loadSampleTop")
    .addEventListener("click", loadSample);
  document.getElementById("clearAll").addEventListener("click", clearAll);
  document.getElementById("swapButton").addEventListener("click", swapVersions);

  compareButton.addEventListener("click", compareDocuments);
  compareTop.addEventListener("click", compareDocuments);

  filterArea.addEventListener("change", () => {
    state.filters.area = filterArea.value;
    renderChanges();
    renderDetail();
  });
  filterSeverity.addEventListener("change", () => {
    state.filters.severity = filterSeverity.value;
    renderChanges();
    renderDetail();
  });
  filterStatus.addEventListener("change", () => {
    state.filters.status = filterStatus.value;
    renderChanges();
    renderDetail();
  });

  exportLog.addEventListener("click", () => exportChangeLog());
  exportImpact.addEventListener("click", () => exportImpactSummary());
  exportEmail.addEventListener("click", () => exportEmailTemplate());
  exportAgenda.addEventListener("click", () => exportAgendaTemplate());

  langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang || "es");
    });
  });

  if (replayButton && videoFrame) {
    replayButton.addEventListener("click", () => {
      videoFrame.currentTime = 0;
      videoFrame.play();
    });
  }

  setLanguage(state.lang);
  setupScrollProgress();
  setupReveal();
  setupScrolly();
  checkBackendStatus();
}

function getStrings() {
  return translations[state.lang]?.strings || translations.es.strings;
}

function getLabels() {
  return translations[state.lang]?.labels || translations.es.labels;
}

function t(key, variables = {}) {
  const template = getStrings()[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = variables[token];
    return value === undefined ? "" : String(value);
  });
}

function applyTranslations() {
  const strings = getStrings();

  document.documentElement.lang = state.lang;
  document.title = strings.pageTitle;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (
      (element.id === "fileNameBaseline" && state.files.baseline) ||
      (element.id === "fileNameRevised" && state.files.revised)
    ) {
      return;
    }
    element.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    element.placeholder = t(key);
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    const key = element.dataset.i18nAria;
    element.setAttribute("aria-label", t(key));
  });

  if (!state.files.baseline) {
    fileNameBaseline.textContent = t("fileEmpty");
  }
  if (!state.files.revised) {
    fileNameRevised.textContent = t("fileEmpty");
  }

  updateCompareHint();
  updateBackendLabel();
}

function setLanguage(lang) {
  if (!translations[lang]) {
    return;
  }
  state.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEYS.lang, lang);
  } catch (error) {
    // Ignore storage failures
  }

  langButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });

  applyTranslations();
  if (state.changes.length > 0) {
    refreshAnalysisForLanguage();
  } else {
    renderAll();
  }
}

function loadLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.lang);
    if (stored && translations[stored]) {
      return stored;
    }
  } catch (error) {
    // Ignore storage failures
  }
  return "es";
}

function setupScrollProgress() {
  if (!scrollProgress) {
    return;
  }
  const update = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const progress = height > 0 ? window.scrollY / height : 0;
    scrollProgress.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
  };
  update();
  window.addEventListener("scroll", () => window.requestAnimationFrame(update), {
    passive: true,
  });
  window.addEventListener("resize", update);
}

function setupReveal() {
  if (revealItems.length === 0) {
    return;
  }
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -10% 0px",
    },
  );
  revealItems.forEach((item) => observer.observe(item));
}

function setupScrolly() {
  if (storySteps.length === 0 || toolCards.length === 0) {
    return;
  }

  let activeTool = null;
  const setActiveTool = (toolId) => {
    if (!toolId || toolId === activeTool) {
      return;
    }
    activeTool = toolId;
    storySteps.forEach((step) => {
      step.classList.toggle("is-active", step.dataset.tool === toolId);
    });
    toolCards.forEach((card) => {
      card.classList.toggle("is-active", card.dataset.tool === toolId);
    });
  };

  if (!("IntersectionObserver" in window)) {
    setActiveTool(storySteps[0].dataset.tool);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveTool(entry.target.dataset.tool);
        }
      });
    },
    {
      threshold: 0.35,
      rootMargin: "-10% 0px -40% 0px",
    },
  );

  storySteps.forEach((step) => observer.observe(step));
  setActiveTool(storySteps[0].dataset.tool);
}

async function refreshAnalysisForLanguage() {
  const baseline = textBaseline.value.trim();
  const revised = textRevised.value.trim();
  if (!baseline || !revised) {
    renderAll();
    return;
  }
  setLoading(true);
  try {
    const previousSelected = state.selectedId;
    const changes = await runAnalysis(baseline, revised);
    state.changes = changes.map((change, index) => ({
      ...change,
      index,
      status: state.statusMap[change.id] || "pending",
    }));
    if (previousSelected && state.changes.some((change) => change.id === previousSelected)) {
      state.selectedId = previousSelected;
    } else {
      state.selectedId = state.changes[0]?.id || null;
    }
    renderAll();
  } catch (error) {
    renderAll();
  } finally {
    setLoading(false);
  }
}

function updateBackendLabel() {
  if (!backendStatus) {
    return;
  }
  if (state.backendAvailable === true) {
    backendStatus.textContent = t("backendConnected");
    backendStatus.classList.remove("backend-offline");
  } else if (state.backendAvailable === false) {
    backendStatus.textContent = t("backendLocal");
    backendStatus.classList.add("backend-offline");
  } else {
    backendStatus.textContent = t("backendUnknown");
    backendStatus.classList.remove("backend-offline");
  }
}

async function checkBackendStatus() {
  try {
    const response = await fetch("/api/health");
    state.backendAvailable = response.ok;
  } catch (error) {
    state.backendAvailable = false;
  }
  updateBackendLabel();
}

function setupDropZone(target) {
  const zone = document.querySelector(`.drop-zone[data-target="${target}"]`);
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file, target);
    }
  });

  const actionButton = zone.querySelector("button");
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      if (target === "baseline") {
        fileBaseline.click();
      } else {
        fileRevised.click();
      }
    });
  }
}

async function handleFile(file, target) {
  if (!file) {
    return;
  }
  state.files[target] = file;
  setStatusMessage(t("statusReadingFile", { name: file.name }), "info");
  setLoading(true);
  try {
    const text = await parseFile(file);
    if (!text.trim()) {
      throw new Error(t("errorNoText"));
    }
    if (target === "baseline") {
      textBaseline.value = text.trim();
      fileNameBaseline.textContent = file.name;
    } else {
      textRevised.value = text.trim();
      fileNameRevised.textContent = file.name;
    }
    setStatusMessage(t("statusFileLoaded", { name: file.name }), "success");
  } catch (error) {
    setStatusMessage(
      t("statusFileError", { name: file.name, error: error.message }),
      "error",
    );
  } finally {
    setLoading(false);
    updateCompareHint();
  }
}

async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return parsePdf(file);
  }
  if (name.endsWith(".docx")) {
    return parseDocx(file);
  }
  return file.text();
}

async function parsePdf(file) {
  if (!window.pdfjsLib) {
    throw new Error(t("errorPdfParser"));
  }
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += `${strings.join(" ")}\n`;
  }
  return fullText;
}

async function parseDocx(file) {
  if (!window.mammoth) {
    throw new Error(t("errorDocxParser"));
  }
  const buffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

function updateCompareHint() {
  const baseline = textBaseline.value.trim();
  const revised = textRevised.value.trim();
  const ready = baseline.length > 0 && revised.length > 0;
  compareButton.disabled = !ready;
  compareTop.disabled = !ready;
  compareHint.textContent = ready ? t("compareHintReady") : t("compareHintNeed");
}

function loadSample() {
  const sample = samples[state.lang] || samples.es;
  textBaseline.value = sample.baseline.trim();
  textRevised.value = sample.revised.trim();
  fileNameBaseline.textContent = "Sample_baseline.txt";
  fileNameRevised.textContent = "Sample_revised.txt";
  setStatusMessage(t("statusDemoLoaded"), "success");
  updateCompareHint();
}

function clearAll() {
  textBaseline.value = "";
  textRevised.value = "";
  state.files.baseline = null;
  state.files.revised = null;
  fileBaseline.value = "";
  fileRevised.value = "";
  fileNameBaseline.textContent = t("fileEmpty");
  fileNameRevised.textContent = t("fileEmpty");
  state.changes = [];
  state.selectedId = null;
  renderAll();
  setStatusMessage(t("statusDataCleared"), "info");
  updateCompareHint();
}

function swapVersions() {
  const temp = textBaseline.value;
  textBaseline.value = textRevised.value;
  textRevised.value = temp;
  const tempName = fileNameBaseline.textContent;
  fileNameBaseline.textContent = fileNameRevised.textContent;
  fileNameRevised.textContent = tempName;
  setStatusMessage(t("statusSwapped"), "info");
  updateCompareHint();
}

function setLoading(show) {
  if (show) {
    loadingOverlay.classList.add("show");
  } else {
    loadingOverlay.classList.remove("show");
  }
}

function setStatusMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
  if (message) {
    clearTimeout(setStatusMessage.timer);
    setStatusMessage.timer = setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.dataset.type = "";
    }, 6000);
  }
}

async function compareDocuments() {
  const baseline = textBaseline.value.trim();
  const revised = textRevised.value.trim();
  if (!baseline || !revised) {
    setStatusMessage(t("statusNeedBoth"), "error");
    return;
  }
  setLoading(true);
  try {
    const changes = await runAnalysis(baseline, revised);
    state.changes = changes.map((change, index) => ({
      ...change,
      index,
      status: state.statusMap[change.id] || "pending",
    }));
    state.selectedId = state.changes[0]?.id || null;
    renderAll();
    if (state.changes.length === 0) {
      setStatusMessage(t("statusNoChanges"), "info");
    } else {
      setStatusMessage(t("statusAnalysisDone"), "success");
    }
  } catch (error) {
    setStatusMessage(t("statusAnalysisError", { error: error.message }), "error");
  } finally {
    setLoading(false);
  }
}

async function runAnalysis(baseline, revised) {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseline, revised, lang: state.lang }),
    });
    if (!response.ok) {
      throw new Error("Backend error");
    }
    const data = await response.json();
    state.backendAvailable = true;
    updateBackendLabel();
    return Array.isArray(data.changes) ? data.changes : [];
  } catch (error) {
    state.backendAvailable = false;
    updateBackendLabel();
    const local = window.DeltaScopeAnalysis?.analyze(baseline, revised, {
      lang: state.lang,
    });
    if (local && Array.isArray(local.changes)) {
      return local.changes;
    }
    if (Array.isArray(local)) {
      return local;
    }
    throw error;
  }
}

function renderAll() {
  renderStats();
  renderImpact();
  renderChanges();
  renderDetail();
}

function renderStats() {
  const total = state.changes.length;
  const critical = state.changes.filter((item) => item.severity === "high").length;
  const schedule = state.changes.filter((item) => item.areas.includes("schedule")).length;
  const compliance = state.changes.filter((item) => item.areas.includes("compliance")).length;
  statTotal.textContent = total;
  statCritical.textContent = critical;
  statSchedule.textContent = schedule;
  statCompliance.textContent = compliance;
}

function renderImpact() {
  const counts = countAreas(state.changes);
  impactScope.textContent = counts.scope;
  impactSchedule.textContent = counts.schedule;
  impactCost.textContent = counts.cost;
  impactRisk.textContent = counts.risk;
  impactCompliance.textContent = counts.compliance;
  impactTesting.textContent = counts.testing;

  if (state.changes.length === 0) {
    impactSummary.textContent = t("impactSummaryEmpty");
    actionList.innerHTML = `<li>${t("impactPlanEmpty")}</li>`;
    return;
  }

  const high = state.changes.filter((item) => item.severity === "high").length;
  impactSummary.textContent = t("impactSummary", {
    critical: high,
    total: state.changes.length,
  });

  const actions = collectPlanActions(state.changes);
  actionList.innerHTML = "";
  actions.forEach((action) => {
    const li = document.createElement("li");
    li.textContent = action;
    actionList.appendChild(li);
  });
}

function countAreas(changes) {
  const counts = {
    scope: 0,
    schedule: 0,
    cost: 0,
    risk: 0,
    compliance: 0,
    testing: 0,
  };
  changes.forEach((change) => {
    change.areas.forEach((area) => {
      if (counts[area] !== undefined) {
        counts[area] += 1;
      }
    });
  });
  return counts;
}

function collectPlanActions(changes) {
  const actionCounts = {};
  changes.forEach((change) => {
    change.actions.forEach((action) => {
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });
  });
  return Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([action]) => action);
}

function renderChanges() {
  const filtered = applyFilters(state.changes);
  changesList.innerHTML = "";
  changesCount.textContent = t("changesCount", { count: filtered.length });

  if (filtered.length === 0) {
    state.selectedId = null;
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.changes.length === 0 ? t("changesEmpty") : t("changesEmptyFiltered");
    changesList.appendChild(empty);
    return;
  }

  if (!filtered.some((change) => change.id === state.selectedId)) {
    state.selectedId = filtered[0].id;
  }

  const labels = getLabels();

  filtered.forEach((change) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `change-item${change.id === state.selectedId ? " active" : ""}`;
    item.addEventListener("click", () => {
      state.selectedId = change.id;
      renderChanges();
      renderDetail();
    });

    const title = document.createElement("div");
    title.className = "change-title";
    title.textContent = `${t("changeLabel")} #${change.index + 1} - ${change.section}`;

    const snippet = document.createElement("div");
    snippet.className = "change-snippet";
    snippet.textContent = change.summary;

    const meta = document.createElement("div");
    meta.className = "change-meta";
    meta.appendChild(createTag(labels.changeType[change.changeType], "tag"));
    meta.appendChild(createTag(labels.severity[change.severity], `tag tag-${change.severity}`));
    meta.appendChild(createTag(labels.status[change.status], "tag tag-status"));
    const areaLabel = change.areas.map((area) => labels.areas[area] || area).join(" - ");
    const areaSpan = document.createElement("span");
    areaSpan.textContent = areaLabel;
    meta.appendChild(areaSpan);

    item.appendChild(title);
    item.appendChild(snippet);
    item.appendChild(meta);
    changesList.appendChild(item);
  });
}

function renderDetail() {
  const change = state.changes.find((item) => item.id === state.selectedId);
  detailBody.innerHTML = "";

  if (!change) {
    detailBadge.textContent = t("detailEmptyBadge");
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("detailEmpty");
    detailBody.appendChild(empty);
    return;
  }

  const labels = getLabels();
  detailBadge.textContent = `${labels.areas[change.areas[0]]} - ${labels.severity[change.severity]}`;

  const headerBlock = document.createElement("div");
  headerBlock.className = "detail-block";
  const headerTitle = document.createElement("h4");
  headerTitle.textContent = `${t("changeLabel")} #${change.index + 1}`;
  const headerMeta = document.createElement("div");
  headerMeta.className = "detail-meta";
  headerMeta.appendChild(createTag(labels.changeType[change.changeType], "tag"));
  headerMeta.appendChild(createTag(labels.severity[change.severity], `tag tag-${change.severity}`));
  headerMeta.appendChild(createTag(labels.status[change.status], "tag tag-status"));
  const headerSection = document.createElement("p");
  headerSection.textContent = `${t("detailSectionLabel")}: ${change.section}`;
  const reasons = document.createElement("p");
  reasons.textContent =
    change.reasons.length > 0 ? `${t("detailReasonsLabel")}: ${change.reasons.join(" | ")}` : "";
  headerBlock.appendChild(headerTitle);
  headerBlock.appendChild(headerMeta);
  headerBlock.appendChild(headerSection);
  if (change.reasons.length > 0) {
    headerBlock.appendChild(reasons);
  }

  const beforeBlock = document.createElement("div");
  beforeBlock.className = "detail-block";
  const beforeTitle = document.createElement("h4");
  beforeTitle.textContent = t("detailBefore");
  const beforeText = document.createElement("pre");
  beforeText.className = "detail-text";
  beforeText.textContent = change.oldText || "-";
  beforeBlock.appendChild(beforeTitle);
  beforeBlock.appendChild(beforeText);

  const afterBlock = document.createElement("div");
  afterBlock.className = "detail-block";
  const afterTitle = document.createElement("h4");
  afterTitle.textContent = t("detailAfter");
  const afterText = document.createElement("pre");
  afterText.className = "detail-text";
  afterText.textContent = change.newText || "-";
  afterBlock.appendChild(afterTitle);
  afterBlock.appendChild(afterText);

  const actionBlock = document.createElement("div");
  actionBlock.className = "detail-block";
  const actionTitle = document.createElement("h4");
  actionTitle.textContent = t("detailActions");
  const actionListEl = document.createElement("ul");
  actionListEl.className = "action-list";
  change.actions.slice(0, 5).forEach((action) => {
    const li = document.createElement("li");
    li.textContent = action;
    actionListEl.appendChild(li);
  });
  actionBlock.appendChild(actionTitle);
  actionBlock.appendChild(actionListEl);

  const statusBlock = document.createElement("div");
  statusBlock.className = "detail-actions";
  statusBlock.appendChild(createStatusButton("accepted", change));
  statusBlock.appendChild(createStatusButton("pending", change));
  statusBlock.appendChild(createStatusButton("clarify", change));
  statusBlock.appendChild(createStatusButton("rejected", change));

  detailBody.appendChild(headerBlock);
  detailBody.appendChild(beforeBlock);
  detailBody.appendChild(afterBlock);
  detailBody.appendChild(actionBlock);
  detailBody.appendChild(statusBlock);
}

function createTag(text, className) {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

function createStatusButton(status, change) {
  const labels = getLabels();
  const button = document.createElement("button");
  button.type = "button";
  button.className = change.status === status ? "primary" : "secondary";
  button.textContent = labels.status[status];
  button.addEventListener("click", () => {
    updateStatus(change.id, status);
  });
  return button;
}

function updateStatus(changeId, status) {
  state.statusMap[changeId] = status;
  saveStatusMap();
  state.changes = state.changes.map((change) =>
    change.id === changeId ? { ...change, status } : change,
  );
  renderChanges();
  renderDetail();
}

function applyFilters(changes) {
  return changes.filter((change) => {
    const areaMatch =
      state.filters.area === "all" || change.areas.includes(state.filters.area);
    const severityMatch =
      state.filters.severity === "all" || change.severity === state.filters.severity;
    const statusMatch =
      state.filters.status === "all" || change.status === state.filters.status;
    return areaMatch && severityMatch && statusMatch;
  });
}

function exportChangeLog() {
  if (state.changes.length === 0) {
    setStatusMessage(t("statusExportEmpty"), "info");
    return;
  }
  const header = [
    "id",
    "section",
    "type",
    "severity",
    "areas",
    "status",
    "old_text",
    "new_text",
  ];
  const rows = state.changes.map((change) => [
    change.id,
    change.section,
    change.changeType,
    change.severity,
    change.areas.join("|"),
    change.status,
    change.oldText,
    change.newText,
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("deltascope_change_log.csv", csv, "text/csv");
}

function exportImpactSummary() {
  if (state.changes.length === 0) {
    setStatusMessage(t("statusExportEmpty"), "info");
    return;
  }
  const counts = countAreas(state.changes);
  const lines = [
    t("exportImpactTitle"),
    "",
    t("exportImpactTotal", { total: state.changes.length }),
    t("exportImpactCritical", {
      critical: state.changes.filter((item) => item.severity === "high").length,
    }),
    "",
    t("exportSummaryByArea"),
    `- ${t("impactScope")}: ${counts.scope}`,
    `- ${t("impactSchedule")}: ${counts.schedule}`,
    `- ${t("impactCost")}: ${counts.cost}`,
    `- ${t("impactRisk")}: ${counts.risk}`,
    `- ${t("impactCompliance")}: ${counts.compliance}`,
    `- ${t("impactTesting")}: ${counts.testing}`,
    "",
    t("exportActionsSuggested"),
    ...collectPlanActions(state.changes).map((action) => `- ${action}`),
  ];
  downloadFile("deltascope_impacto.txt", lines.join("\n"), "text/plain");
}

function exportEmailTemplate() {
  if (state.changes.length === 0) {
    setStatusMessage(t("statusExportEmpty"), "info");
    return;
  }
  const critical = state.changes.filter((item) => item.severity === "high").length;
  const labels = getLabels();
  const lines = [
    t("exportEmailSubject"),
    "",
    t("exportEmailGreeting"),
    "",
    t("exportEmailIntro"),
    `- ${t("exportImpactTotal", { total: state.changes.length })}`,
    `- ${t("exportImpactCritical", { critical })}`,
    "",
    t("exportEmailImpactTitle"),
    ...collectImpactHighlights(state.changes),
    "",
    t("exportEmailActionsTitle"),
    ...collectPlanActions(state.changes).map((action) => `- ${action}`),
    "",
    t("exportEmailChangesTitle"),
    ...state.changes.slice(0, 5).map((change) =>
      `- ${change.section}: ${change.summary} (${labels.severity[change.severity]})`,
    ),
    "",
    t("exportEmailOutro"),
  ];
  downloadFile("deltascope_email.txt", lines.join("\n"), "text/plain");
}

function exportAgendaTemplate() {
  if (state.changes.length === 0) {
    setStatusMessage(t("statusExportEmpty"), "info");
    return;
  }
  const lines = [
    t("exportAgendaTitle"),
    "",
    t("exportAgendaSummary"),
    t("exportAgendaTotal", { total: state.changes.length }),
    t("exportAgendaCritical"),
    ...state.changes
      .filter((change) => change.severity === "high")
      .slice(0, 5)
      .map((change) => `   - ${change.section}: ${change.summary}`),
    t("exportAgendaPlan"),
    t("exportAgendaTesting"),
    t("exportAgendaActions"),
    ...collectPlanActions(state.changes).map((action) => `   - ${action}`),
  ];
  downloadFile("deltascope_agenda.txt", lines.join("\n"), "text/plain");
}

function collectImpactHighlights(changes) {
  const counts = countAreas(changes);
  const highlights = [];
  if (counts.scope) {
    highlights.push(`- ${t("impactScope")}: ${counts.scope}`);
  }
  if (counts.schedule) {
    highlights.push(`- ${t("impactSchedule")}: ${counts.schedule}`);
  }
  if (counts.cost) {
    highlights.push(`- ${t("impactCost")}: ${counts.cost}`);
  }
  if (counts.compliance) {
    highlights.push(`- ${t("impactCompliance")}: ${counts.compliance}`);
  }
  if (highlights.length === 0) {
    highlights.push("- " + t("impactSummaryEmpty"));
  }
  return highlights;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadStatusMap() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.statuses);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

function saveStatusMap() {
  try {
    localStorage.setItem(STORAGE_KEYS.statuses, JSON.stringify(state.statusMap));
  } catch (error) {
    // Ignore storage failures
  }
}

init();
